# Button actions

## User outcome

A user can trigger the basic demo action and see both its visible result and event-log entry.

## Entry points

- The visible `Click Me!` button.

## Preconditions

- Window discovery passed for the current target.

## MCP path

1. Inspect with `get_page_structure`.
2. Call `click_by_selector` with `[data-testid="click-button"]`.
3. Read visible body text and the event log with an observation command.
4. Capture the resulting window with `take_screenshot`.

Every `send_command_to_electron` and `take_screenshot` call must include `projectName: "debug-electron-mcp-demo"` and the exact target ID.

## Proof

Require the visible success text and a matching event-log entry. Validate and inspect the PNG.

## Reset

Restart the demo for a completely empty event log.

## Gotchas

A successful click response proves dispatch only. The rendered result is the assertion.
