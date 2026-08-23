# Debug Electron MCP demo verification map

This project map covers the bundled `examples/demo-app` window. The reusable skill and lifecycle helper are in `.agents/skills/verify-debug-electron-mcp/`.

## Baseline

- Use project `debug-electron-mcp-demo` on port 9270.
- Require the exact `MCP Demo App` target from MCP `list_electron_windows`; exclude DevTools.
- Scope every MCP action by the project name and exact target ID.
- Reset mutable demo state before asserting exact values.
- Store proof under `.verification/electron/<run-id>/evidence/`.

## Evidence

Pair every action with rendered-state observation. Capture before and after PNGs for state changes, validate them with the helper, and record a compact JSON proof summary.

## Features

- [Window discovery](window-discovery.md)
- [Button actions](button-actions.md)
- [Form input](form-input.md)
- [Counter state](counter-state.md)
- [Screenshots and logs](screenshots-and-logs.md)
