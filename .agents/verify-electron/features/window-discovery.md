# Window discovery

## User outcome

An MCP client can find the normal demo window, distinguish it from DevTools, and obtain an exact target ID for later actions.

## Entry points

- `list_electron_windows` for target discovery.
- `get_electron_window_info` for application and child-window information.

## Preconditions

- The lifecycle helper reports `cdp-ready` for the current run.
- Debug Electron MCP project `debug-electron-mcp-demo` is registered on port 9270.

## MCP path

1. Call `list_electron_windows` with `projectName: "debug-electron-mcp-demo"` and `includeDevTools: false`.
2. Require one target titled `MCP Demo App` whose URL contains `examples/demo-app/index.html` and whose ID matches helper `doctor` output.
3. Call `get_electron_window_info` with the same project name and `includeChildren: false`.

## Proof

Record the project, port, target ID, title, URL, and both MCP results. A discovered DevTools target does not satisfy this feature.

## Reset

No mutable state.

## Gotchas

Development mode opens DevTools. Never use the first raw CDP target or an unscoped MCP call.
