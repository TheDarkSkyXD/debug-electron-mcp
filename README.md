# Debug Electron MCP

Debug Electron MCP controls Electron renderer windows through Chrome DevTools Protocol.

It implements MCP 2026-07-28. HTTP is stateless. Each request is an independent `POST /mcp` exchange. There is no `initialize` request, no `Mcp-Session-Id`, and no streaming `GET` or `DELETE` lifecycle.

## Why this exists

An agent debugging an Electron app can read your source but cannot see the app. Most failures are invisible from source alone.

| Symptom | What an agent can do here |
| --- | --- |
| Blank or white window | `page_info`, `get_dom`, `query_selector`, and a clipped `take_screenshot` |
| Silent renderer exception | `read_electron_logs`, `send_command_to_electron` with `get_body_text` |
| UI not responding | `perform_electron_actions` for click, type, key, scroll, and a `wait` probe |
| Wrong route or URL | `open_url`, `page_info`, `reload` |
| Auth or state bug | `get_cookies`, `set_cookie`, `get_storage`, `set_storage` |
| Perf jank | `trace` on `perform_electron_actions`, openable in `chrome://tracing` |
| App already running | `find_electron_apps` recovers the port you forgot |

## Recommended agent loop

```text
find_electron_apps  /  start_electron_app  /  register_project
    -> list_electron_windows
    -> page_info
    -> read_electron_logs
    -> take_screenshot
    -> wait
    -> click / type_text / press_key / get_dom / evaluate
    -> get_storage / get_cookies
    -> trace + reproduce, then inspect the trace
    -> stop_electron_app
```

## Requirements

- Node.js 20 or later
- Electron started with `--remote-debugging-port=<port>`, or launched with `start_electron_app`
- An MCP client that supports `server/discover` and MCP 2026-07-28

## Install

```sh
npx -y @debugelectron/debug-electron-mcp@latest
```

For a stdio client configuration:

```json
{
  "mcpServers": {
    "debug-electron-mcp": {
      "command": "npx",
      "args": ["-y", "@debugelectron/debug-electron-mcp@latest"]
    }
  }
}
```

### Upgrading from 1.x

Version 2 requires Node.js 20 and a client that supports MCP 2026-07-28. It replaces the legacy initialize/session lifecycle with independent stateless calls and uses the ten-tool catalog documented below. Update any saved tool names or arguments when moving an existing client configuration from 1.x.

Project selection is explicit. Register a project, then pass `projectName` to a window, command, log, or screenshot call when you want to restrict the search to that app.

Nearby Electron calls reuse discovery results for 5 seconds and renderer CDP connections for 15 seconds. The cache and pool have fixed limits and require no MCP session or client handle.

```json
{ "projectName": "music-app", "port": 9222 }
```

Start the app with the registered port:

```sh
electron . --remote-debugging-port=9222
```

## Tools

The catalog has seventeen compact tools. Use `perform_electron_actions` for low-latency interaction sequences. It runs as many as 50 ordered actions through one target lookup and one pooled CDP connection. Use `describe_electron_command` for the exact arguments of a legacy Electron command instead of receiving the whole command manual on every `tools/list` call.

| Tool                        | Purpose                                     |
| --------------------------- | ------------------------------------------- |
| `describe_electron_command` | Return the schema for one command.          |
| `find_electron_apps`        | List running Electron processes and ports.  |
| `get_electron_window_info`  | Inspect one detected Electron app.          |
| `list_electron_windows`     | List available renderer windows.            |
| `list_projects`             | List durable project registrations.         |
| `perform_electron_actions`  | Run an ordered batch of direct CDP actions. |
| `read_console`              | Read recorded renderer console and errors.  |
| `read_electron_logs`        | Read a bounded process log snapshot.        |
| `read_network`              | Read recorded network activity.             |
| `register_project`          | Register a DevTools port.                   |
| `send_cdp_command`          | Run one raw `Domain.method` call.           |
| `send_command_to_electron`  | Execute one named renderer command.         |
| `start_electron_app`        | Launch an app and register its port.        |
| `stop_electron_app`         | Stop a running app by pid.                  |
| `take_screenshot`           | Capture a window, or one element.           |
| `unregister_project`        | Remove a registration.                      |

### Prompts

Three canned workflows, for the failures where tool order reliably matters and getting it wrong produces a misleading answer.

| Prompt                     | Use when                                |
| -------------------------- | --------------------------------------- |
| `debug_blank_window`       | A window is blank or white.             |
| `find_renderer_exception`  | A renderer error is suspected.          |
| `ui_smoke_check`           | One interaction needs a pass/fail verdict. |

### Console and network recording

`read_console` and `read_network` buffer events per window. Recording starts when you pass `record: true`, and each keeps a bounded 200-entry ring, so a chatty renderer cannot grow them without limit.

```json
{ "projectName": "music-app", "record": true }
```

Call them again to read. `read_console` accepts `errorsOnly` or an exact `level`; `read_network` accepts `failuresOnly`, which covers both transport failures and HTTP 4xx and 5xx. A recorder lives only as long as the pooled connection that feeds it, so nothing it captured outlives that session.

MCP 2026's server event union carries only catalog-change events, so there is no channel to push console output through. Recording is therefore polled rather than streamed. See [ADR 0006](docs/adr/0006-observability-and-profiling.md).


The command tool takes a command name and its argument object:

```json
{
  "projectName": "music-app",
  "command": "click_by_text",
  "args": { "text": "Save" }
}
```

The action tool supports compact snapshots, coordinate or selector targeting, click, double-click, long press, hover, scroll, text input, key input, URL navigation, reload, pause and resume, cookie and web-storage reads and writes, and legacy commands. URL navigation is open-world: it can load network, file, and application-scheme locations, while rejecting executable and privileged browser schemes. Each result includes its original action index. Set `stopOnError` to `false` to collect independent failures and continue the batch.

```json
{
  "projectName": "music-app",
  "actions": [
    { "kind": "snapshot", "maxElements": 50 },
    {
      "kind": "click",
      "target": { "kind": "selector", "selector": "[aria-label='Search']" }
    },
    { "kind": "type_text", "text": "Boards of Canada" },
    { "kind": "press_key", "key": "Enter" }
  ]
}
```

Tool results keep machine-readable values in `structuredContent`. Text is a short status line.

Screenshots return inline image data when no `outputPath` is supplied. When `outputPath` is supplied, they write a file and return only file metadata. Set `delivery` to `inline` to request bytes explicitly, `format` to `jpeg` with an optional `quality`, or `selector` to capture just that element's on-screen box.

Add a `trace` or `profile` object to record a Chrome DevTools trace or a V8 CPU profile across the whole batch. The file is written to `outputPath`, or to a temp file. Traces open in `chrome://tracing` or the Perfetto UI; profiles open in Chrome's Performance panel. Both are scoped to one call so the server never holds a CDP session open between requests, and both run through the same output-path guard.

```json
{
  "projectName": "music-app",
  "trace": { "outputPath": "D:/tmp/search.json" },
  "profile": { "outputPath": "D:/tmp/search.cpuprofile" },
  "actions": [
    { "kind": "type_text", "selector": "#search", "text": "Boards of Canada" },
    { "kind": "press_key", "key": "Enter" },
    { "kind": "command", "command": "wait", "args": { "text": "Results", "timeout": 5000 } }
  ]
}
```

The profiler is started after the trace, so its own setup cost is not attributed to the interaction being measured.

### Launching and finding apps

`find_electron_apps` lists running Electron processes with the remote debugging port each was launched with, which recovers a port you did not record. `start_electron_app` launches an app with remote debugging enabled and registers it as a project in one call. The app keeps running after the call returns; stop it with `stop_electron_app`. Pass `inspectMain: true` to also open a Node inspector on the main process.

## Environment variables

| Variable                            | Purpose                                                      |
| ----------------------------------- | ------------------------------------------------------------ |
| `DEBUG_ELECTRON_MCP_ALLOWED_ROOTS`  | Restrict which app paths `start_electron_app` may launch.     |
| `DEBUG_ELECTRON_MCP_OUTPUT_ROOTS`   | Restrict where screenshots and traces may be written.         |
| `DEBUG_ELECTRON_MCP_NO_SANDBOX`     | Always pass `--no-sandbox` to a launched app.                 |
| `ELECTRON_PATH`                     | Use a specific Electron binary instead of the local install.  |

Screenshots and traces are always refused for sensitive system and credential locations, including `~/.ssh`, `/etc`, `/usr`, `C:\Windows`, and `C:\Program Files`, whether or not an allowlist is set.

## HTTP mode

```sh
npx @debugelectron/debug-electron-mcp@latest serve --port 3100
```

Use `http://127.0.0.1:3100/mcp`. `GET /health` reports server readiness. The MCP endpoint accepts only modern `POST` requests. The MCP SDK validates `MCP-Protocol-Version`, `Mcp-Method`, `Mcp-Name`, and the per-request metadata envelope.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `No Electron applications found` | The app was not started with `--remote-debugging-port`. Start it with one, use `start_electron_app`, or pass `projectName` pointing at a registered port. |
| `Project "x" is not registered` | Call `register_project` first, or omit `projectName` to search all ports. |
| Wrong window is targeted | Pass `targetId` from `list_electron_windows`, or `windowTitle` to match by title. |
| `wait` times out on a condition that is true | The element may be present but not visible. `wait` with a selector requires a non-zero bounding box. |
| Later calls fail after a `pause` | A paused renderer answers nothing, so the connection is retired automatically. Send `resume` to continue. |
| Clip is empty or off-screen | The element is scrolled out of the viewport. Scroll it in first; the tool refuses rather than returning the whole window. |
| Screenshot or trace write is refused | The path is in a blocked system location, or outside `DEBUG_ELECTRON_MCP_OUTPUT_ROOTS`. |
| `start_electron_app` path rejected | The path is outside `DEBUG_ELECTRON_MCP_ALLOWED_ROOTS`. |
| Element screenshot is cut down | It exceeded the viewport. The result reports `truncated` with the full element size. |
| Actions stop early | `stopOnError` defaults to true. Set it to false to collect every failure. |
| `send_cdp_command` rejected | The method must be in `Domain.method` form. |

## Design notes

**Why stateless.** Every request is self-contained, so calls can be retried, load-balanced, or run concurrently with no session affinity. The project registry is durable application configuration, not protocol state, so registrations survive restarts. See [ADR 0001](docs/adr/0001-stateless-mcp-2026.md).

**Why batches.** Fifty actions cost one MCP round trip and one CDP lease instead of fifty of each. See [ADR 0004](docs/adr/0004-batch-direct-electron-actions.md).

**Why tracing is per-batch.** A separate start and stop call would have to hold a CDP socket open across two unrelated requests, which is the retained state the stateless design exists to avoid. The batch is also the honest unit: you want a trace of the interaction you just drove. See [ADR 0005](docs/adr/0005-port-capability-coverage.md).

**Path safety.** Screenshots and traces are refused for sensitive system and credential locations whether or not an allowlist is set, and the guard runs before any capture, so a refused path costs no round trip.

## Development

```sh
npm install
npm run typecheck
npm run lint
npm test
npm run build
npm run deps:check:mature
npm run measure:mcp
npm run benchmark:mobile-parity
npm run verify:mcp
```

`deps:check:mature` rejects any resolved lockfile package younger than seven days. Targeted npm overrides keep permissive transitive ranges from bypassing that policy. `measure:mcp` reports the real `tools/list` payload size, deterministic discovery and connection benchmarks, and the latency difference between one action batch and separate MCP calls.

`benchmark:mobile-parity` pins the official mobile-next/mobile-mcp repository, builds it from its lockfile, and compares both servers through persistent stdio processes. The paired workloads cover tool discovery, application-context reads, one coordinate click, five separate equivalent interactions, and Electron's five-action batch. Fake CDP and mobilecli adapters remove device-specific noise while preserving each server's production dispatch and command paths. The script alternates measurement order and fails when backend operation counts differ. Pass custom settings directly when needed:

```sh
node scripts/benchmark-mobile-parity.mjs --samples 50 --warmups 10 --adapter-delays 0,1 --output benchmark.json
```

This comparison measures MCP and server-path overhead. It does not replace a separate real-device benchmark with an Android emulator and an Electron application.

Type-checking and every production build use the native TypeScript 7 compiler. The `typescript` package name intentionally points to the official TypeScript 6 compatibility package for tools such as `typescript-eslint` and `ts-loader`, which still require the compiler API that TypeScript 7 does not expose.

The source follows enforced responsibility boundaries: transports depend on application ports, Electron and filesystem code live in adapters, and `src/index.ts` composes them. See [ADR 0002](docs/adr/0002-enforce-responsibility-boundaries.md) for the dependency rules and context-budget decision.

See the [stateless architecture modernization report](docs/reports/2026-08-21-stateless-architecture-modernization.md) for measured context, response-time, build, dependency, and verification results.
