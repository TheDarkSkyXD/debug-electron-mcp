---
name: verify-debug-electron-mcp
description: Bootstrap and run user-visible verification for any Electron app controlled through Debug Electron MCP. Use after Electron UI, CDP, screenshot, logging, or MCP changes, and when installing this skill into another Electron repository.
---

# Verify with Debug Electron MCP

Use Debug Electron MCP as the only interaction transport. Use the bundled helper only to launch, identify, and clean up the exact app process owned by the verification run.

## Portability contract

The reusable skill lives at `.agents/skills/verify-debug-electron-mcp/`. Project-specific data lives at `.agents/verify-electron/` and is never stored in the skill folder.

Copy the reusable skill directory into the same path in another Electron repository. On first use there, bootstrap the project profile and feature map described below. The helper uses only Node.js built-ins and has no dependency on this MCP server's source tree, package manager, or SDK.

## Bootstrap a project

If `.agents/verify-electron/profile.json` is absent:

1. Inspect the repository's package scripts, Electron main entry, preload, renderer entry points, and existing remote-debugging setup.
2. Choose one non-interactive launch command that starts the actual app with Chrome DevTools Protocol enabled on a dedicated port. Put preparation such as compilation inside that project command rather than inside this skill.
3. Create `.agents/verify-electron/profile.json` using [the profile contract](references/project-profile.md). Keep commands and paths relative to the repository.
4. Add the configured evidence root, normally `.verification/`, to the repository's ignore file.
5. Create `.agents/verify-electron/features/README.md` and one file per important user behavior using [the feature-map contract](references/feature-map.md). Derive these from the real application; do not copy another project's selectors or flows.
6. Run `node .agents/skills/verify-debug-electron-mcp/scripts/verify.mjs profile` and fix every validation error.
7. Use Debug Electron MCP `list_projects`. If `projectName` is absent, call `register_project` with the profile's exact project name and port. If that name or port conflicts with an existing registration, stop instead of silently retargeting either project.

Do not modify production behavior merely to make a proof easy. A dedicated debug launch script or development-only CDP switch is acceptable when the repository does not already expose one.

## Start and identify the app

Choose a unique run ID and retain it through cleanup:

```powershell
$verifyRunId = "verify-$(Get-Date -Format yyyyMMdd-HHmmss)"
node .agents/skills/verify-debug-electron-mcp/scripts/verify.mjs launch --run-id $verifyRunId
node .agents/skills/verify-debug-electron-mcp/scripts/verify.mjs doctor --run-id $verifyRunId
```

The helper refuses an occupied port, records the launched PID, excludes DevTools targets, and requires exactly one target matching the profile. `doctor` proves only process and CDP readiness.

Complete the transport check through Debug Electron MCP:

1. Call `list_electron_windows` with the profile's `projectName` and `includeDevTools: false`.
2. Require the result to contain the same target ID, title, URL, and port reported by `doctor`.
3. Call `get_electron_window_info` with that `projectName` when the behavior under test depends on window state.
4. Use the returned exact `targetId` for every action and screenshot. Keep `projectName` on calls so multiple Electron apps cannot cross-target.

Do not claim the app is ready until both the helper and MCP checks pass.

## Drive a feature

Read `.agents/verify-electron/features/README.md`, then open only the feature files relevant to the change.

For each entry point under test:

1. Navigate through the same visible controls a user uses.
2. Inspect with `get_page_structure`, `find_elements`, or another read-only `send_command_to_electron` command before choosing selectors.
3. Act with `send_command_to_electron`, scoped by `projectName` and exact `targetId`.
4. Prove the resulting renderer state with a second read-only command. A successful click response alone is not proof.
5. Obtain an absolute screenshot path with `evidence-path`, pass it to `take_screenshot`, and validate it with `assert-png`.
6. Inspect the image itself when layout, visibility, state, or rendering matters.
7. Record a compact JSON summary with `record`, naming the feature, entry point, actions, observed state, screenshot, and any skipped path. In PowerShell, pipe JSON to `record --stdin` so native argument quoting cannot alter it.

Prefer stable user-facing text, roles, labels, and explicit test IDs. Use `eval` only when the MCP's observation commands cannot expose the required rendered state, and never use it to call hidden application APIs instead of the visible workflow.

## Evidence rules

- Keep evidence under the profile's configured root and the current run ID.
- Pair every mutation with an observable result.
- Capture before and after images for meaningful visual or state transitions.
- Record the target ID and project name in the proof summary.
- Treat console output as diagnostic evidence, not as proof of visible behavior.
- Report each skipped entry point and its unmet precondition. Do not transfer a pass from one path to another.

## Cleanup

Always clean up, including after a failed proof:

```powershell
node .agents/skills/verify-debug-electron-mcp/scripts/verify.mjs cleanup --run-id $verifyRunId
```

Cleanup stops only the recorded process tree, confirms the configured port closed, removes transient state, and retains evidence. If the port remains open, report it and do not kill an untracked process.

## Maintain the installation

Update `.agents/verify-electron/profile.json` when the launch contract, target identity, or debug port changes. Update the project feature map in the same change whenever a user-visible entry point, selector, route, or expected result changes. Keep the reusable skill free of application-specific names and behavior.
