# Counter state

Counter state lets an MCP user reset, increment, decrement, and visibly confirm stateful interaction in the running Electron renderer.

## Sub-features

- `counter-reset` returns the rendered count to zero.
- `counter-increment` raises the rendered count by one.
- `counter-decrement` lowers the rendered count by one.
- `counter-log` records each state transition in the visible event log.
- `counter-proof` captures the before state, action, resulting state, and two PNGs.

## How to get to it (user POV)

- Choose `Reset Counter`, `+ Increment`, or `- Decrement` in the Counter Demo section through MCP.
- Read the large number between the decrement and increment buttons.
- Read the Event Log section for the matching transition.

## Driving it with verify-debug-electron-mcp

Preconditions:

- Doctor is healthy for `$verifyRunId`.
- The demo target is the normal `MCP Demo App` page, not DevTools.

- **Run the maintained proof.** Run `node .agents/skills/verify-debug-electron-mcp/scripts/verify.mjs prove-counter --run-id $verifyRunId`. The command resets to 0, captures `counter-before.png`, clicks `[data-testid="increment-button"]`, reads 1 and the event log, and captures `counter-after.png`.
- **Inspect the transcript.** Read `.verification/debug-electron-mcp/$verifyRunId/evidence/counter-proof.json`. It records every MCP call and the two screenshot paths.
- **Confirm the rendered result.** The transcript's `after.text` contains `"1"`, and `eventLog.text` contains `Counter incremented to 1`.

## Gotchas

- The counter retains state for the life of the demo process. Reset before asserting an exact number.
- Reading `window.mcpDemo.getCounter()` alone is insufficient because it skips the visible UI. The maintained proof reads `#counter-value` and captures the window.
- A click response does not prove the handler ran. Require both the rendered number and event-log entry.
- Cleanup closes the app but preserves the counter proof files.
