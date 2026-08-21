# Screenshots and logs

## User outcome

An MCP client can preserve the visible demo state and retrieve recent renderer diagnostics.

## Entry points

- `take_screenshot` for the selected demo target.
- `console_log` followed by `read_electron_logs` for a fresh diagnostic marker.

## Preconditions

- Window discovery passed.
- Obtain an absolute output path from the lifecycle helper's `evidence-path` command.

## MCP path

1. Call `take_screenshot` with the project name, exact target ID, and absolute output path.
2. Validate the file with helper `assert-png` and inspect it visually.
3. Send a unique marker with `console_log`.
4. Call `read_electron_logs` with `logType: "console"`, a bounded line count, `follow: false`, and the project name.

## Proof

Keep the valid PNG and the log result containing the fresh marker. The marker demonstrates log retrieval, not visible feature behavior.

## Reset

No app-state reset. Use a new marker for every run.

## Gotchas

DevTools is open in development mode. Always pass the exact normal-page target ID to screenshots.
