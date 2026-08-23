# Project profile contract

Store one profile at `.agents/verify-electron/profile.json` in the Electron repository:

```json
{
  "version": 1,
  "projectName": "my-electron-app",
  "port": 9222,
  "launch": {
    "command": "npm",
    "args": ["run", "dev:debug"],
    "cwd": ".",
    "env": {
      "NODE_ENV": "development"
    },
    "readyTimeoutMs": 30000,
    "stripElectronRunAsNode": true
  },
  "target": {
    "title": "My Electron App",
    "urlIncludes": "/renderer/index.html"
  },
  "evidenceRoot": ".verification/electron"
}
```

## Fields

- `version` must be `1`.
- `projectName` must exactly match the Debug Electron MCP project registration. Spaces are allowed, but surrounding whitespace and control characters are not.
- `port` must be the dedicated CDP port assigned to that project.
- `launch.command` is an executable name or a path relative to `launch.cwd`.
- `launch.args` contains literal arguments. Do not put a shell command line in one string.
- `launch.cwd` is relative to the repository root and must stay inside it.
- `launch.env` contains only non-secret development values required by the app.
- `launch.readyTimeoutMs` defaults to 30000 and may range from 1000 through 180000.
- `launch.stripElectronRunAsNode` defaults to true. Keep it true unless the app intentionally needs that Electron variable.
- `target.title` is an exact title match.
- `target.titleIncludes` is an optional case-insensitive partial title match.
- `target.urlIncludes` is an optional case-sensitive URL fragment.
- `target` must supply at least one rule. All supplied rules must match exactly one non-DevTools page.
- `evidenceRoot` is relative to the repository and defaults to `.verification/electron`.

All paths are validated at the CLI boundary. Absolute paths and paths escaping the repository are rejected.

On Windows, npm-style `.cmd` and `.bat` launchers are supported. Shell metacharacters are rejected; put complex launch logic in a repository-owned script and call that script with simple literal arguments.

## Launch command guidance

Prefer a repository-owned command that both prepares and launches the app:

```json
"launch": {
  "command": "npm",
  "args": ["run", "dev:debug"],
  "cwd": "."
}
```

The corresponding script might be:

```json
"dev:debug": "electron . --remote-debugging-port=9222"
```

An application may instead set the port before `app.whenReady()`:

```javascript
const port = process.env.ELECTRON_DEBUG_PORT;
if (port) app.commandLine.appendSwitch('remote-debugging-port', port);
```

Then pass the value through `launch.env`. Keep the profile port, app port, and MCP registration identical.

## Choosing target rules

Use the narrowest stable combination. An exact product window title plus a renderer URL fragment is preferred. Avoid ephemeral query strings, generated asset hashes, changing document titles, and a generic title shared by multiple windows.

Run `probe` against an already-running port when diagnosing rules:

```powershell
node .agents/skills/verify-debug-electron-mcp/scripts/verify.mjs probe --port 9222
```
