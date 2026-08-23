# Candidate 5.4: strict stateless MCP v2 with a compact command catalog

## Usage from the caller's view

Start stdio in strict `2026-07-28` mode.

```json
{
  "mcpServers": {
    "electron": {
      "command": "npx",
      "args": ["-y", "@debugelectron/debug-electron-mcp@latest"]
    }
  }
}
```

Start the stateless HTTP entry.

```sh
npx @debugelectron/debug-electron-mcp@latest serve --port 3100
```

HTTP accepts only `POST /mcp`. Each request carries `Mcp-Method`, `Mcp-Name`, and request `_meta`. The server rejects `initialize`, `Mcp-Session-Id`, `GET /mcp`, `DELETE /mcp`, and every v1 code path.

Register explicit application state once.

```ts
await client.callTool({
  name: 'register_project',
  arguments: { projectName: 'todo-desktop', port: 9222 }
});
```

Call project-scoped tools with an explicit `projectName`.

```ts
await client.callTool({
  name: 'send_command_to_electron',
  arguments: {
    projectName: 'todo-desktop',
    command: 'wait',
    args: { selector: '.ready', timeoutMs: 5000 }
  }
});
```

Fetch exact command help only when needed.

```ts
await client.callTool({
  name: 'describe_electron_command',
  arguments: { command: 'drag' }
});
```

Consume compact structured results.

```json
{
  "content": [{ "type": "text", "text": "2 windows" }],
  "structuredContent": {
    "windows": [
      { "id": "A1", "title": "Main", "url": "file:///app/index.html", "port": 9222 }
    ]
  }
}
```

Measure the migration and enforce the package-age gate.

```sh
npm run deps:maturity:check
npm run deps:maturity:update
npm run benchmark:mcp -- --label before --output .audit/benchmarks/before.json
npm run benchmark:mcp -- --label after --output .audit/benchmarks/after.json
```

## Problem

The current server is a v1 transport wrapper around ad hoc handlers. It stores HTTP session transports in memory, mutates a process-global default project, serializes large text blobs instead of compact structured results, scans ports in sequence, and publishes a `send_command_to_electron` schema that does not match its real argument surface. Moving to SDK v2 needs a real shape change, not a package rename.

## Shape

Pick one strict MCP kernel with three durable ideas only.

- One immutable tool catalog.
- One explicit project registry.
- One short-lived Electron operation scope per request.

Everything else becomes transport-local or request-local.

```ts
type ProjectName = string & { readonly __brand: 'ProjectName' };
type DevToolsPort = number & { readonly __brand: 'DevToolsPort' };
type CommandName = keyof typeof commandRegistry;

type WindowTarget =
  | { kind: 'first' }
  | { kind: 'targetId'; targetId: string }
  | { kind: 'windowTitle'; windowTitle: string };

type ProjectRecord = Readonly<{
  name: ProjectName;
  port: DevToolsPort;
  windowTitlePattern?: string;
}>;

type ToolResult<T extends object> = Readonly<{
  content: readonly [{ type: 'text'; text: string }];
  structuredContent: T;
  isError?: true;
}>;

interface ProjectRegistry {
  resolve(name: ProjectName): Promise<ProjectRecord | undefined>;
  list(): Promise<readonly ProjectRecord[]>;
  register(input: RegisterProjectInput): Promise<ProjectRecord>;
  unregister(name: ProjectName): Promise<boolean>;
}

interface ElectronGateway {
  discover(input: DiscoveryRequest, signal: AbortSignal): Promise<readonly ElectronApp[]>;
  run(input: CommandEnvelope, signal: AbortSignal): Promise<CommandOutcome>;
  screenshot(input: ScreenshotRequest, signal: AbortSignal): Promise<ScreenshotOutcome>;
  readLogs(input: LogRequest, signal: AbortSignal): Promise<LogOutcome>;
}

interface CommandSpec<TArgs extends object, TResult extends object> {
  readonly name: CommandName;
  readonly argsSchema: z.ZodType<TArgs>;
  readonly run: (ctx: OperationContext, args: TArgs) => Promise<TResult>;
  readonly summary: string;
}

interface AppServices {
  readonly projects: ProjectRegistry;
  readonly electron: ElectronGateway;
  readonly catalog: ToolCatalogSnapshot;
}
```

The MCP surface stays small.

```ts
function createAppServices(): AppServices;
function buildMcpServer(services: AppServices): McpServer;
function startStdioServer(services: AppServices): Promise<void>;
function startHttpServer(port: number, services: AppServices): Promise<CloseHandle>;
function discoverElectronApps(
  ports: readonly DevToolsPort[],
  options: { concurrency: number; timeoutMs: number; signal: AbortSignal }
): Promise<readonly ElectronApp[]>;
```

## Module map

```text
src/index.ts                    CLI and composition root
src/mcp/server.ts               buildMcpServer and strict capability registration
src/mcp/catalog.ts              frozen tool definitions and cached tools/list payload
src/mcp/http.ts                 v2 HTTP adapter, POST /mcp only, health route, shutdown
src/mcp/stdio.ts                v2 stdio adapter
src/mcp/results.ts              compact ToolResult builders
src/projects/store.ts           file-backed ProjectRegistry with atomic writes
src/electron/discovery.ts       bounded parallel CDP target discovery
src/electron/commands.ts        commandRegistry and exact per-command validation
src/electron/gateway.ts         WebSocket and Playwright operation lifecycles
scripts/deps-maturity.mjs       seven-day stable-version check and update
scripts/benchmark-mcp.mts       before and after token, byte, and latency capture
```

Delete `src/create-server.ts`, `src/serve.ts`, `src/handlers.ts`, `src/tools.ts`, and `src/schemas.ts` after the new catalog is live. Delete dead `src/utils/logs.ts`, `src/utils/electron-process.ts`, and `src/utils/project.ts`. Remove unused `@modelcontextprotocol/sdk`, `zod-to-json-schema`, `ajv`, `ajv-formats`, `jest`, and `ts-jest`. Move `@types/ws` to development dependencies. Raise the runtime floor to Node 20 and pin the stable v2 server and Node adapter line first.

## Rationale

Use the official v2 server package and the Node adapter, but hide them behind `src/mcp/http.ts` and `src/mcp/stdio.ts`. That keeps protocol details out of Electron automation code and makes the transport cut exact. There is no compatibility route, no hand-written `initialize` logic, and no session map.

Keep project state explicit and durable. `register_project`, `unregister_project`, and `list_projects` remain real application tools because they model shared user intent. Everything else takes `projectName` directly. The old cwd auto-detect and auto-register behavior disappears. The server no longer mutates global default state just because it started in a folder.

Shrink `tools/list` by making `send_command_to_electron` a compact envelope tool again, but repair drift with one source of truth. `commandRegistry` owns each command name, exact Zod schema, handler, summary, and examples. `tools/list` publishes only the stable envelope plus short summaries. `describe_electron_command` returns the exact JSON Schema and examples for one command from the same registry. The public list stays small and deterministic. The runtime contract stays exact.

Precompute the catalog once. Sort tool definitions lexically. Reuse the same serialized `tools/list` payload for every request. Return a long public TTL because the catalog changes only on process restart. Do not advertise MCP resources or prompts in the v2 cut. This keeps discovery cheap.

Return machine data in `structuredContent` first. Text becomes one short line. `list_electron_windows` returns arrays, not pretty JSON in prose. `take_screenshot` defaults to metadata plus file path and only inlines image data when the caller asks for `delivery: 'inline'`. That cuts both response size and prompt cost.

Parallelize discovery with a bounded worker pool. One request probes all candidate ports concurrently under one timeout budget. `list_projects` batches its connection checks through the same discovery call instead of re-scanning each port in a loop. Add a tiny in-process cache for identical discovery inputs with a sub-second TTL. The cache stores no client identity and no protocol state.

Treat every CDP, WebSocket, and Playwright object as request-scoped. `ElectronGateway` opens, uses, and closes them in `try/finally`. `read_electron_logs` becomes a bounded snapshot tool in the migration cut. Continuous log streaming waits for a later explicit subscription design. The same rule applies to screenshots and command execution. One owner closes every handle.

## Tradeoffs accepted

- We accept a breaking removal of auto-detect and auto-register in exchange for one explicit stateless model.
- We accept one extra help tool in exchange for a much smaller and more cacheable `tools/list`.
- We accept a request-scoped Electron connection model in exchange for clear lifecycles and no leaked protocol state.
- We accept a tiny discovery cache in exchange for lower repeated latency, while keeping all durable state explicit.

## Alternatives considered

### One MCP tool per Electron command

This gives exact schemas up front, but it explodes `tools/list`, raises prompt cost, and turns every new DOM command into catalog churn. It lost because the main requirement here is a small deterministic list.

### Explicit runtime handles for windows and CDP sessions

This shape would add tools like `open_runtime` and `close_runtime`, then pass a handle between calls. It fits the 2026 spec because state can be explicit, but it adds lifecycle rules, orphan cleanup, and more user-visible concepts than this repo needs. It lost because the migration already has enough breaking surface.

### Custom JSON-RPC router instead of the v2 SDK

This would avoid SDK adapters, but it would make this repo own version negotiation, method-header checks, `server/discover`, result typing, and every future protocol change. It lost because the protocol should stay in the SDK, not in application code.

## Risks and open questions

- The project registry needs atomic read-modify-write behavior before concurrent HTTP mutations are safe.
- The current README promises convenience behavior that this cut intentionally removes. That needs a major-version call.
- Some callers may depend on inline screenshots by default. The metadata-first default saves tokens but changes behavior.
- The command-help tool must stay wired to the same registry as execution or drift will come back.

## Next implementation step

Build the strict v2 HTTP and stdio entries first, prove `server/discover` and `tools/list` through real runtime checks, then migrate the catalog onto `commandRegistry` and delete the v1 transport files in the same wave.

## Verification and measurement

`scripts/benchmark-mcp.mts` should launch the built server and drive it through real stdio and HTTP clients. Record exact UTF-8 bytes, exact tokens under one pinned tokenizer, and p50 and p95 latency for `server/discover`, `tools/list`, `list_electron_windows`, and one scoped `send_command_to_electron` call. Save raw samples and a compare report.

The runtime verification suite should prove these cases.

- `server/discover` works without a prior request.
- Strict HTTP accepts only `POST /mcp`.
- `initialize`, `Mcp-Session-Id`, `GET /mcp`, and `DELETE /mcp` fail.
- Header and JSON-RPC method mismatches fail.
- Repeated `tools/list` responses are byte-identical and carry a positive TTL.
- Every command example from `describe_electron_command` parses and reaches the matching handler.
- Forced command, screenshot, and log failures close every WebSocket and browser handle.

`scripts/deps-maturity.mjs` should read npm publish dates and reject any direct dependency version published less than seven full days before the run. `deps:maturity:update` should raise only packages that pass the same gate. That gives the package-maturity check and update lever the migration requires.
