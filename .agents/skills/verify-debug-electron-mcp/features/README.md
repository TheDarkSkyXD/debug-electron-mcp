# Debug Electron MCP verification map

This directory maps the user-facing MCP behaviors covered by the bundled Electron demo. Read this index before driving the app, then use the matching feature recipe.

## Baseline preconditions

- Run commands from the repository root in PowerShell.
- Root dependencies and `examples/demo-app/node_modules` exist.
- Port 9222 is free before launch.
- Create a run ID and launch through `verify.mjs`; never attach to an instance the run did not start.
- Run doctor and require `"status": "healthy"` before a feature recipe.
- Keep `$verifyRunId` unchanged until cleanup completes.

## Driving conventions

- Use `call` so each action crosses the stdio MCP boundary.
- Prefer the demo's `data-testid` selectors when visible text is duplicated.
- Let the helper inject the current CDP target ID.
- Save meaningful calls with `--evidence <name>.json`.
- Use `screenshot` for visible proof and keep the app title in frame.
- Reset mutable demo state before a recipe when the feature file says to.

## Proof and skip reporting

- Capture the action and resulting state, not only the final screenshot.
- Pair a click or fill result with rendered text, the event log, or another read-only MCP call.
- Keep all output under `.verification/debug-electron-mcp/<run-id>/evidence/`.
- Record the feature name and commands used in the task report.
- If a listed path is unreachable, save the failed MCP result and name the unmet precondition.
- Do not claim a skipped feature or entry point passed through another path.

## Feature entry contract

Each feature file describes the behavior from the MCP user's point of view, the exact helper commands, and the observable state that proves the feature works.

## Features

- [Window discovery](./window-discovery.md) covers tool discovery, CDP target listing, titles, ports, and DevTools filtering.
- [Basic button actions](./button-actions.md) covers page structure, selector and text clicks, rendered results, and event logging.
- [Form input and submission](./form-input.md) covers placeholder-based fill, selector targeting, form submission, and rendered values.
- [Counter state](./counter-state.md) covers reset, increment, rendered state, event history, and before/after screenshots.
- [Screenshots and console logs](./screenshots-and-logs.md) covers PNG evidence, console commands, and log retrieval.
