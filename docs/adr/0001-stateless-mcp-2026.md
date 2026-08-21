# ADR 0001: Adopt the stateless MCP 2026 protocol

## Status

Accepted on 2026-08-20.

## Context

The server currently uses the MCP 2025 session lifecycle. It creates protocol sessions during `initialize`, stores transports in a process map, and routes later requests with `Mcp-Session-Id`. Its tool catalog also embeds a large Electron command manual in every `tools/list` response.

MCP 2026 removes initialization and protocol sessions. A server exposes `server/discover`, accepts one independent HTTP POST per request, and receives protocol and client metadata in each request. The TypeScript SDK v2 implements this model through `createMcpHandler`, `toNodeHandler`, and `serveStdio`.

The project registry is durable application configuration. It is not an MCP session. Electron connections and browser objects are request-scoped runtime resources.

## Decision

The runtime has one immutable tool catalog, one explicit project registry, and one short-lived Electron operation scope per request.

- Build a fresh `McpServer` for each HTTP request through one server factory.
- Use the stable MCP v2 server and Node packages with legacy protocol support rejected.
- Ignore an incoming `Mcp-Session-Id`. Never mint, echo, or infer state from it.
- Require the MCP 2026 HTTP method and identity headers at the transport boundary.
- Keep project selection explicit in tool inputs. Remove the mutable process-wide default project.
- Register tools in lexical order and publish fixed public cache hints.
- Replace the embedded Electron command manual with a compact discriminated command registry and an on-demand command-description tool.
- Return compact structured results. Include screenshot bytes only when the caller requests inline delivery.
- Run Electron discovery with bounded concurrency and stable output ordering.
- Close WebSockets, Playwright browsers, and other request resources in `finally` blocks.
- Keep log reads bounded snapshots. Do not emulate continuous subscriptions through a tool call.
- Remove dead adapters, invalid scripts, and dependencies that have no production or test caller.

The package maturity rule means a selected release must be at least seven days old. A repository script checks direct dependency publication dates against that floor. It replaces the unsupported npm configuration key that attempted to enforce the rule.

## Consequences

HTTP requests can be retried or distributed without protocol-session affinity. Durable project configuration remains available across requests because it belongs to the application, not the MCP transport.

The common `tools/list` response becomes smaller and deterministic. Detailed command guidance moves to an explicit request, so callers pay that token cost only when needed.

Legacy MCP clients are intentionally incompatible. Clients must implement `server/discover` and the MCP 2026 request envelope.

Continuous log streaming remains out of scope until it can use the protocol subscription model.

## Verification

Automated checks cover strict discovery, independent calls, ignored legacy session headers, deterministic tool lists, command schema validation, resource cleanup, and compact screenshot delivery. Measurement scripts report catalog bytes, an estimated token count, discovery latency samples, and direct-package release ages.

The supporting research is in `docs/research/mcp-2026-release-candidate.md`. The competing architecture sketches are in `.audit/architecture/`.
