---
name: verify-debug-electron-mcp
description: Drive Debug Electron MCP through its stdio MCP interface against the bundled Electron demo app. Use after tool, CDP, screenshot, window-targeting, or interaction changes to prove behavior in a running desktop app.
---

# Verify Debug Electron MCP

This skill drives the published product boundary. It launches the bundled Electron demo, starts the built MCP server through the SDK's stdio client, calls real tools, and records what the Electron window shows.

Run every command from the repository root in PowerShell.

## Launch

The root and `examples/demo-app` dependencies must already exist. Launch builds the MCP server with the checked-in Webpack configuration, refuses to reuse an occupied port 9222, starts the demo with CDP enabled, and records the exact PID it owns.

```powershell
$verifyRunId = "verify-$(Get-Date -Format yyyyMMdd-HHmmss)"
node .agents/skills/verify-debug-electron-mcp/scripts/verify.mjs launch --run-id $verifyRunId
```

Ready means the command returns `"status": "ready"` with a live PID and a page target titled `MCP Demo App` on port 9222. The build and Electron logs are written under `.verification/debug-electron-mcp/$verifyRunId/evidence/`.

Only one verification instance can run because the demo hardcodes port 9222. If launch says the port is occupied, stop. Do not drive or kill that existing instance.

Teardown for the instance created above is:

```powershell
node .agents/skills/verify-debug-electron-mcp/scripts/verify.mjs cleanup --run-id $verifyRunId
```

## Doctor

Run doctor after launch and whenever a tool result looks stale or targets the wrong window.

```powershell
node .agents/skills/verify-debug-electron-mcp/scripts/verify.mjs doctor --run-id $verifyRunId
```

Doctor requires all of these facts:

- The recorded Electron PID is alive.
- CDP port 9222 exposes a page titled `MCP Demo App`.
- A fresh stdio MCP connection reports the built server name and version.
- The server lists all eight expected tools.
- `list_electron_windows` sees the demo target on port 9222.

The local stdio and CDP path has no authentication. Doctor records that fact instead of pretending to validate credentials that do not exist. Its report is saved as `evidence/doctor.json`.

## Drive

Read [the feature map](./features/README.md) before choosing a recipe. The helper injects the current demo target ID for window-bound tools, so commands never depend on whichever window happens to come first.

Call any MCP tool with a JSON object:

```powershell
node .agents/skills/verify-debug-electron-mcp/scripts/verify.mjs call --run-id $verifyRunId --tool list_electron_windows --arguments '{}' --evidence windows.json
node .agents/skills/verify-debug-electron-mcp/scripts/verify.mjs call --run-id $verifyRunId --tool send_command_to_electron --arguments '{"command":"get_page_structure"}' --evidence page-structure.json
```

Capture the visible window:

```powershell
node .agents/skills/verify-debug-electron-mcp/scripts/verify.mjs screenshot --run-id $verifyRunId --name current-state.png
```

The maintained smoke proof resets the visible counter, captures it, clicks the increment control through MCP, reads the rendered result and event log, then captures the changed window:

```powershell
node .agents/skills/verify-debug-electron-mcp/scripts/verify.mjs prove-counter --run-id $verifyRunId
```

## Evidence

Proof lives at `.verification/debug-electron-mcp/<run-id>/evidence/`. The directory is ignored by Git and survives cleanup.

A valid proof must:

- Drive a control through `send_command_to_electron`, not a test-only setter.
- Record the MCP call and returned content.
- Capture the state before and after the action when behavior changes state.
- Read a second user-visible view such as rendered text or the event log.
- Save a PNG with the `MCP Demo App` identity visible.
- Report skipped feature-map entries as skipped. One convenient path does not prove the others.

The helper replaces base64 image bodies in JSON transcripts with their encoded length. The PNG file is the image evidence. Mocks are not valid for this skill because the bundled demo and local MCP boundary are available.

## Cleanup

Always clean up in a `finally` step, including after a failed doctor or drive:

```powershell
node .agents/skills/verify-debug-electron-mcp/scripts/verify.mjs cleanup --run-id $verifyRunId
```

Cleanup uses the PID recorded at launch. On Windows it stops that PID's process tree. On Unix it signals that detached process group. It never kills by process name. It removes `state.json`, waits for port 9222 to close, writes `evidence/cleanup.json`, and leaves every proof artifact in place.

## Helpers

The executable helper is `.agents/skills/verify-debug-electron-mcp/scripts/verify.mjs`. Invoke it with `node` as shown above.

```text
launch         Build the server and start the owned Electron demo instance.
doctor         Check the PID, CDP target, MCP identity, tool list, and window discovery.
call           Invoke one real MCP tool and optionally save its transcript.
screenshot     Save and validate a PNG of the current demo target.
prove-counter  Run the maintained end-to-end counter proof.
cleanup        Stop only the recorded process tree and preserve evidence.
```

Run `node .agents/skills/verify-debug-electron-mcp/scripts/verify.mjs help` for the command synopsis.
