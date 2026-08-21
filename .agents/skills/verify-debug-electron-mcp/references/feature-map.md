# Project feature-map contract

Store project-specific verification recipes under `.agents/verify-electron/features/`.

## Index

`README.md` must state:

- the app and target covered by the map;
- baseline state and test-data assumptions;
- shared navigation and reset rules;
- evidence conventions;
- links to every feature file.

## Feature file

Create one Markdown file per coherent user behavior. Include:

1. **User outcome** — what the person can accomplish.
2. **Entry points** — every distinct visible route, menu, button, shortcut, or window that reaches it.
3. **Preconditions** — authentication, data, permissions, window state, and navigation state.
4. **MCP path** — inspection, user action, and observation commands in order. Include stable labels or selectors from this project.
5. **Proof** — the rendered state and screenshots that distinguish success from a no-op.
6. **Reset** — how to return mutable state to a known baseline.
7. **Gotchas** — dialogs, secondary windows, timing, DevTools, platform differences, or intentionally unsupported paths.

Keep commands at the level of Debug Electron MCP tool calls. Do not make a project feature file depend on a custom client inside the reusable skill.

## Coverage discipline

- Give each entry point its own result. Do not infer one menu or shortcut works because another route reaches the same screen.
- Map important negative states such as validation errors, empty states, permission denial, or retry behavior when users can encounter them.
- Prefer the minimum flow that crosses the real renderer boundary and proves the outcome.
- Update recipes in the same change as altered labels, selectors, routes, or behavior.
