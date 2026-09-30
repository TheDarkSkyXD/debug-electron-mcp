# ADR 0005: Port capability coverage with path-guarded output

## Status

Accepted

## Context

Debug Electron MCP exposes a stateless tool catalog over MCP 2026. It inspected windows, drove renderer input, and captured screenshots, but it left three gaps against the wider Electron-debugging feature set.

First, the operator had to launch the application themselves. There was no `start`, no `stop`, and no way to recover the remote debugging port of an app that was already running. An agent could not own the app lifecycle it was debugging.

Second, the inspection surface stopped at the commands the renderer already exposed. There was no document read, no element query, no page metadata, and the `wait` command understood only a selector, text, or a duration. An agent debugging a blank window or a stuck spinner had no way to ask the questions that actually distinguish those failures.

Third, and most seriously, `take_screenshot` wrote to any path the caller named. Screenshot bytes are attacker-influenced data: a renderer under test renders whatever the application under test renders. A prompt-injected agent could name an output path inside a system directory, and the server would create it. Launching an app is a comparable problem, since it executes a local binary with caller-supplied arguments.

A companion project, `electron-mcp-server`, implements all of this. Its architecture was not adopted. It is a stateful MCP 2025 stdio server that owns Electron child processes, keeps a process map, and exposes 36 individual tools. Adopting it would have discarded the stateless protocol, the batched action design from ADR 0004, the typed command registry from ADR 0001, and the published package contract. Its value is coverage, not structure.

## Decision

Port capability, not architecture. Every new capability is expressed through the existing stateless port, the existing batched action union, and the existing command registry.

Lifecycle gains `start_electron_app`, `stop_electron_app`, and `find_electron_apps`. The started child is detached and unref'd so it outlives the request that launched it; the caller tracks it by pid and stops it explicitly. A failed start tears the child down rather than leaving an orphan holding a port the caller believes is free.

Inspection gains `page_info`, `get_dom`, and `query_selector` commands, and the `wait` command gains `hidden`, `enabled`, `urlIncludes`, and `minCount`. All requested wait conditions are evaluated in one poll and reported together, so the caller learns which conditions were satisfied on timeout instead of only that they were not.

Screenshots gain `format`, `quality`, and `selector`. A selector clip is intersected with the viewport, because `Page.captureScreenshot` does not reject an off-screen clip — it returns the whole window and silently answers a different question.

State and control gain `get_cookies`, `set_cookie`, `get_storage`, `set_storage`, `reload`, `pause`, and `resume` actions. `send_cdp_command` is a bounded escape hatch for any `Domain.method`, time-limited to 30 seconds.

Tracing is scoped to a single `perform_electron_actions` call through an optional `trace` object. A separate start and stop tool would have to hold a live CDP socket open across two unrelated HTTP requests, which is the retained session state ADR 0001 exists to prevent. Per-batch capture is also the honest unit: the caller wants a trace of the interaction it just drove.

Path safety is enforced at the adapter boundary, in one place, for every write. `resolveOutputPath` rejects a built-in blocklist of system and credential locations, matched as directory prefixes so blocking `/etc` also rejects `/etc/cron.d/payload`. `DEBUG_ELECTRON_MCP_OUTPUT_ROOTS`, when set, makes its directories the only legal destinations. `DEBUG_ELECTRON_MCP_ALLOWED_ROOTS` applies the same gate to `start_electron_app` paths, because launching runs a local binary.

## Consequences

- An agent can now own the app lifecycle it debugs, recover a forgotten port, read the DOM, wait on real conditions, and capture a performance trace — all within one request each.
- Traces cover a batch, not an arbitrary span across requests. A caller that needs a wider window must reproduce more of the interaction inside the batch.
- The `perform_electron_actions` result is now an envelope of `{ results, trace? }` rather than a bare array. This is a breaking change to that tool's return shape, released in the next minor version.
- Screenshot and trace writes are rejected for paths an operator has not allowed. Callers writing to a sensitive location now get an error instead of a file.
- The event plumbing that tracing needs was added to the CDP session, which previously discarded id-less protocol messages.

## Verification

Unit tests assert the blocklist rejects nested paths beneath a blocked root, the allowlist rejects a sibling directory that shares a name prefix, a clipped screenshot intersects an oversized element with the viewport and refuses one scrolled out of view, tracing unsubscribes its listener so a pooled session does not retain a completed trace, pause and resume enable the debugger first, and a multi-condition `wait` compiles every requested condition into one poll.
