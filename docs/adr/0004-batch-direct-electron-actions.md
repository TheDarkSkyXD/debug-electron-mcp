# ADR 0004: Batch direct Electron actions

## Status

Accepted

## Context

Debug Electron MCP already cached DevTools discovery and pooled CDP connections, but each public command still required a separate MCP request. Screenshots opened a new Playwright connection for every capture. The command catalog also lacked compact element snapshots, coordinate input, long press, scrolling, direct key input, and URL navigation.

Mobile MCP servers commonly expose these interaction primitives as separate tools. Copying that surface would increase the tool catalog and still pay one transport round trip per action. Public session handles would reduce setup work, but they would conflict with this server's stateless MCP protocol and introduce request-affinity state.

## Decision

Add one `perform_electron_actions` tool with a discriminated action union. A request may contain up to 50 ordered actions and executes them through one target lookup and one internal CDP pool lease. Results retain action indexes and report failures independently. `stopOnError` controls whether execution stops at the first failure.

Direct CDP handles pointer input, scrolling, text input, key input, navigation, and screenshots. Navigation is marked open-world because it accepts network, file, and application-scheme URLs. Executable and privileged browser schemes are rejected. Compact snapshots return only visible interactive elements with bounded names, values, bounds, roles, enabled state, and reusable CSS selectors. Existing named renderer commands remain available as an action variant and through `send_command_to_electron`.

Keep the public protocol stateless. Connection reuse remains an internal optimization with bounded lifetime and capacity. Compile each tool's JSON Schema once at module load because the MCP 2026 HTTP handler creates a fresh server object for each request.

## Consequences

- Multi-step interactions pay one MCP round trip and one CDP lease instead of one of each per action.
- Screenshots reuse the same connection pool as commands and no longer require a Playwright connection.
- The catalog grows by one tool while adding ten action variants.
- A stale target is refreshed only when the CDP connection cannot open before an operation starts. Pointer, text, and navigation actions are never replayed after execution begins.
- Application lifecycle, crash reporting, video recording, arbitrary filesystem transfer, and process control remain separate future designs. Some have no direct Electron equivalent to mobile device management and require explicit security boundaries.

## Verification

The deterministic benchmark runs five actions both as one batch and as five separate MCP calls. It also asserts that nearby operations perform one discovery scan and open one CDP connection. The Electron demo verification launches the packaged app, performs real actions through the built HTTP MCP server, observes the resulting renderer state, and validates a pooled screenshot.
