# Window discovery

Window discovery lets an MCP client find the running demo window, distinguish it from DevTools, and obtain a stable target ID for later commands.

## Sub-features

- `windows-list` lists non-DevTools page targets with IDs, titles, URLs, and ports.
- `windows-info` reports the active Electron application and its child-window count.
- `windows-filter` excludes the automatically opened DevTools target by default.
- `tools-list` proves the stdio server exposes the expected MCP tool set.

## How to get to it (user POV)

- Ask the MCP server to run `list_electron_windows`.
- Ask the MCP server to run `get_electron_window_info`.
- Run doctor to verify the server identity and complete tool list before choosing a window.

## Driving it with verify-debug-electron-mcp

Preconditions:

- Launch completed for `$verifyRunId`.
- Doctor reports `MCP Demo App` on port 9222.

- **List windows.** Run `node .agents/skills/verify-debug-electron-mcp/scripts/verify.mjs call --run-id $verifyRunId --tool list_electron_windows --arguments '{}' --evidence windows.json`. The result contains one normal page titled `MCP Demo App`, its target ID, `port: 9222`, and the demo file URL.
- **Inspect window information.** Run `node .agents/skills/verify-debug-electron-mcp/scripts/verify.mjs call --run-id $verifyRunId --tool get_electron_window_info --arguments '{"includeChildren":false}' --evidence window-info.json`. The result reports a running Electron application and omits the DevTools child from the visible window list.
- **Prove the tool set.** Read `.verification/debug-electron-mcp/$verifyRunId/evidence/doctor.json`. Its `toolNames` array contains all eight names listed in the skill's Doctor section.

## Gotchas

- Development mode opens DevTools, so the raw CDP endpoint exposes more than one target.
- A bare first-window assumption can select DevTools. Use the target ID injected by the helper.
- Port 9222 may belong to another application. Launch refuses that state; do not work around the refusal.
- `includeDevTools` changes the list contract. Keep it false unless that behavior is the subject of the test.
