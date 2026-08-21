# Debug Electron MCP

Debug Electron MCP controls Electron renderer windows through Chrome DevTools Protocol.

It implements MCP 2026-07-28. HTTP is stateless. Each request is an independent `POST /mcp` exchange. There is no `initialize` request, no `Mcp-Session-Id`, and no streaming `GET` or `DELETE` lifecycle.

## Requirements

- Node.js 20 or later
- Electron started with `--remote-debugging-port=<port>`
- An MCP client that supports `server/discover` and MCP 2026-07-28

## Install

```sh
npx -y @debugelectron/debug-electron-mcp@latest
```

For a stdio client configuration:

```json
{
  "mcpServers": {
    "debug-electron-mcp": {
      "command": "npx",
      "args": ["-y", "@debugelectron/debug-electron-mcp@latest"]
    }
  }
}
```

Project selection is explicit. Register a project, then pass `projectName` to a window, command, log, or screenshot call when you want to restrict the search to that app.

```json
{ "projectName": "music-app", "port": 9222 }
```

Start the app with the registered port:

```sh
electron . --remote-debugging-port=9222
```

## Tools

The catalog has nine compact tools. Use `describe_electron_command` for the exact arguments of an Electron command instead of receiving the whole command manual on every `tools/list` call.

| Tool | Purpose |
| --- | --- |
| `describe_electron_command` | Return the schema for one command. |
| `get_electron_window_info` | Inspect one detected Electron app. |
| `list_electron_windows` | List available renderer windows. |
| `list_projects` | List durable project registrations. |
| `read_electron_logs` | Read a bounded log snapshot. |
| `register_project` | Register a DevTools port. |
| `send_command_to_electron` | Execute one named renderer command. |
| `take_screenshot` | Capture a window. |
| `unregister_project` | Remove a registration. |

The command tool takes a command name and its argument object:

```json
{
  "projectName": "music-app",
  "command": "click_by_text",
  "args": { "text": "Save" }
}
```

Tool results keep machine-readable values in `structuredContent`. Text is a short status line.

Screenshots return inline PNG data when no `outputPath` is supplied. When `outputPath` is supplied, they write a PNG and return only file metadata. Set `delivery` to `inline` to request bytes explicitly.

## HTTP mode

```sh
npx @debugelectron/debug-electron-mcp@latest serve --port 3100
```

Use `http://127.0.0.1:3100/mcp`. `GET /health` reports server readiness. The MCP endpoint accepts only modern `POST` requests. The MCP SDK validates `MCP-Protocol-Version`, `Mcp-Method`, `Mcp-Name`, and the per-request metadata envelope.

## Development

```sh
npm install
npm run typecheck
npm run lint
npm test
npm run build
npm run deps:check:mature
npm run measure:mcp
npm run verify:mcp
```

`deps:check:mature` rejects pinned direct dependencies younger than seven days. `measure:mcp` reports the real `tools/list` payload size and a deterministic discovery benchmark.

Type-checking and every production build use the native TypeScript 7 compiler. The `typescript` package name intentionally points to the official TypeScript 6 compatibility package for tools such as `typescript-eslint` and `ts-loader`, which still require the compiler API that TypeScript 7 does not expose.

The source follows enforced responsibility boundaries: transports depend on application ports, Electron and filesystem code live in adapters, and `src/index.ts` composes them. See [ADR 0002](docs/adr/0002-enforce-responsibility-boundaries.md) for the dependency rules and context-budget decision.

See the [stateless architecture modernization report](docs/reports/2026-08-21-stateless-architecture-modernization.md) for measured context, response-time, build, dependency, and verification results.
