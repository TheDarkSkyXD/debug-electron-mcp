# Screenshots and console logs

Screenshots and console logs let an MCP user preserve the visible Electron state and inspect renderer messages produced by real interactions.

## Sub-features

- `screenshot-target` captures the exact demo target selected during doctor.
- `screenshot-file` writes a valid PNG and a compact JSON receipt.
- `console-command` emits a renderer console message through MCP.
- `console-read` retrieves recent Electron console output through MCP.

## How to get to it (user POV)

- Ask the MCP server to take a screenshot of the active demo window.
- Trigger a visible action or send a console message through `send_command_to_electron`.
- Ask `read_electron_logs` for recent console lines.

## Driving it with verify-debug-electron-mcp

Preconditions:

- Doctor is healthy for `$verifyRunId`.
- The visible window is in the state the proof should capture.

- **Capture the target.** Run `node .agents/skills/verify-debug-electron-mcp/scripts/verify.mjs screenshot --run-id $verifyRunId --name desktop-state.png`. The helper writes a PNG, checks its signature, and writes `desktop-state.png.json` without embedding base64 image data.
- **Emit a marker.** Run `node .agents/skills/verify-debug-electron-mcp/scripts/verify.mjs call --run-id $verifyRunId --tool send_command_to_electron --arguments '{"command":"console_log","args":{"message":"verification-log-marker"}}' --evidence console-marker.json`.
- **Read console logs.** Run `node .agents/skills/verify-debug-electron-mcp/scripts/verify.mjs call --run-id $verifyRunId --tool read_electron_logs --arguments '{"logType":"console","lines":50,"follow":false}' --evidence console-logs.json`. Inspect the transcript for the marker or for the renderer's recent demo messages.
- **Pair evidence.** Keep `desktop-state.png`, its JSON receipt, `console-marker.json`, and `console-logs.json` under the same run ID.

## Gotchas

- A screenshot without `outputPath` returns image data in memory. Use the helper's `screenshot` command so proof survives the MCP process.
- DevTools is open in development mode. The helper targets the normal demo page by exact title and target ID.
- Console history depends on the CDP runtime session. If an old line is absent, emit a fresh marker and read again.
- A valid PNG proves capture, not the preceding behavior. Pair it with the action transcript and rendered-state check.
