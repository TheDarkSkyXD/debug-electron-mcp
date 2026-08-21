# Basic button actions

Basic button actions let an MCP user inspect the demo controls, click them by a stable handle or visible text, and observe both the rendered result and event log.

## Sub-features

- `button-structure` exposes the three basic action buttons through page structure.
- `button-selector` clicks `Create New Item` through its `data-testid` selector.
- `button-text` clicks a uniquely named action through visible text.
- `button-result` updates `#action-result` and appends an event-log entry.

## How to get to it (user POV)

- Ask `send_command_to_electron` for `get_page_structure`.
- Click `Create New Item`, `Submit Form`, or `Cancel Operation` through the MCP command tool.
- Read the result box and event log through the same MCP connection path.

## Driving it with verify-debug-electron-mcp

Preconditions:

- Doctor is healthy for `$verifyRunId`.
- The demo's Basic Actions section is visible in the page structure.

- **Inspect controls.** Run `node .agents/skills/verify-debug-electron-mcp/scripts/verify.mjs call --run-id $verifyRunId --tool send_command_to_electron --arguments '{"command":"get_page_structure"}' --evidence buttons-structure.json`. The response names the basic action controls.
- **Click by selector.** Run `node .agents/skills/verify-debug-electron-mcp/scripts/verify.mjs call --run-id $verifyRunId --tool send_command_to_electron --arguments '{"command":"click_by_selector","args":{"selector":"[data-testid=\"create-button\"]"}}' --evidence create-click.json`. The MCP result reports a successful click.
- **Read the rendered result.** Run `node .agents/skills/verify-debug-electron-mcp/scripts/verify.mjs call --run-id $verifyRunId --tool send_command_to_electron --arguments '{"command":"eval","args":{"code":"document.getElementById(\"action-result\")?.textContent"}}' --evidence create-result.json`. The text contains `Create New Item button clicked!`.
- **Capture proof.** Run `node .agents/skills/verify-debug-electron-mcp/scripts/verify.mjs screenshot --run-id $verifyRunId --name button-action.png`. The PNG shows the app title and the result box.

## Gotchas

- `Submit Form` appears in both Basic Actions and the real form. Use a selector when the intended button matters.
- A successful command response is not enough. Read `#action-result` or the event log.
- The action result is replaced by each basic button. Capture evidence before clicking another one.
