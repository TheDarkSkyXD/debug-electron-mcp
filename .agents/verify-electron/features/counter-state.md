# Counter state

## User outcome

A user can reset, increment, and decrement the counter and see each state transition.

## Entry points

- `Reset Counter`
- `+ Increment`
- `- Decrement`

## Preconditions

- Window discovery passed.
- Reset before asserting an exact number.

## MCP path

1. Click `[data-testid="reset-button"]` and read `#counter-value`; require `0`.
2. Capture `counter-before.png` through `take_screenshot`.
3. Click `[data-testid="increment-button"]` and read `#counter-value`; require `1`.
4. Read `#event-log`; require `Counter incremented to 1`.
5. Capture `counter-after.png`.
6. Exercise decrement separately and require its rendered value and event-log transition.

Use `eval` only to read `document.getElementById(...).textContent` when a standard observation command cannot isolate the value. Scope every call to project `debug-electron-mcp-demo` and the exact target ID.

## Proof

Keep the before and after reads, event-log result, and two validated PNGs in one proof summary. Inspect both images.

## Reset

Click the visible reset control.

## Gotchas

Do not call `window.mcpDemo` or another hidden API to change state. The visible controls are the feature boundary.
