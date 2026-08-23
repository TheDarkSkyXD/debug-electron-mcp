# Candidate 5.5: strict MCP 2026 server factory

## Usage from the caller's view

Run one server factory through either supported transport. Both reject pre-2026 traffic.

```json
{
  "mcpServers": {
    "electron": { "command": "npx", "args": ["@debugelectron/debug-electron-mcp", "stdio"] }
  }
}
```

```sh
npx @debugelectron/debug-electron-mcp serve --port 3100
```

An HTTP client sends one request per `POST /mcp`. The v2 client supplies `MCP-Protocol-Version`, `Mcp-Method`, and `Mcp-Name`. There is no `initialize`, `Mcp-Session-Id`, `GET /mcp`, or `DELETE /mcp` path.

Project selection is an explicit tool argument. The CLI no longer auto-registers the current directory or mutates a default project.

```ts
await client.callTool({
  name: 'send_command_to_electron',
  arguments: {
    projectName: 'desktop-app',
    command: 'click_by_text',
    args: { text: 'Save' }
  }
});
```

Results put machine-readable data in `structuredContent`. Text content is one compact status line.

```ts
const result = await client.callTool({
  name: 'list_electron_windows',
  arguments: { projectName: 'desktop-app' }
});
result.structuredContent;
// { ok: true, windows: [{ id: 'A1', title: 'Settings', url: 'app://settings', port: 9222 }] }
```

Screenshots do not send base64 unless the caller asks for it.

```ts
await client.callTool({ name: 'take_screenshot', arguments: {
  projectName: 'desktop-app', delivery: 'file'
} });
await client.callTool({ name: 'take_screenshot', arguments: {
  projectName: 'desktop-app', delivery: 'inline'
} });
```

Command help moves out of the always-paid tool description.

```ts
await client.callTool({
  name: 'get_electron_command_help',
  arguments: { command: 'fill_input' }
});
```

## Problem

The current server couples v1 sessions, a process-global default project, hand-written tool docs, generic command arguments, and CDP resource ownership. A package rename cannot produce the 2026 protocol. The new SDK needs explicit v2 serving entries, per-request HTTP server instances, and a connection-pinned stdio factory. The persistent project registry remains application state. It must not become protocol session state.

## Recommended shape

Use one `buildServer(services)` factory. `createMcpHandler` calls it once per HTTP request. `serveStdio` calls it once for the stdio connection. Both entries pass `{ legacy: 'reject' }`. This is the only server construction path.

```ts
type ProjectName = string & { readonly __brand: 'ProjectName' };
type DevToolsPort = number & { readonly __brand: 'DevToolsPort' };
type TargetId = string & { readonly __brand: 'TargetId' };

interface ProjectConfig {
  readonly name: ProjectName; readonly port: DevToolsPort;
  readonly windowTitlePattern?: string;
}

interface ProjectStore {
  register(input: RegisterProject): Promise<ProjectConfig>;
  unregister(name: ProjectName): Promise<boolean>;
  resolve(name: ProjectName): Promise<ProjectConfig | undefined>;
  list(): Promise<readonly ProjectConfig[]>;
}

interface ElectronGateway {
  discover(scope: DiscoveryScope, signal?: AbortSignal): Promise<readonly ElectronApp[]>;
  execute<T>(target: TargetSelector, operation: CdpOperation<T>, signal?: AbortSignal): Promise<T>;
  screenshot(input: ScreenshotRequest, signal?: AbortSignal): Promise<ScreenshotResult>;
  readLogs(input: LogRequest, signal?: AbortSignal): Promise<LogResult>;
  close(): Promise<void>;
}

interface ServerServices {
  readonly projects: ProjectStore; readonly electron: ElectronGateway;
  readonly metrics: MetricsSink;
}

function buildServer(services: ServerServices): McpServer;
function startHttp(input: HttpStartOptions, services: ServerServices): Promise<CloseableServer>;
function startStdio(services: ServerServices): Promise<void>;
```

`buildServer` uses `McpServer` from `@modelcontextprotocol/server`. It registers Zod 4 schemas directly. The SDK owns JSON Schema generation and boundary validation. It configures fixed public cache hints.

```ts
new McpServer(SERVER_INFO, {
  capabilities: { tools: {} },
  cacheHints: {
    'tools/list': { ttlMs: 86_400_000, cacheScope: 'public' },
    'server/discover': { ttlMs: 86_400_000, cacheScope: 'public' }
  }
});
```

The catalog is a frozen array in lexical order. Descriptions state only intent. Examples and command manuals come from `get_electron_command_help`. Stable order plus cache hints cuts polling and improves byte-level and prompt-cache reuse.

## Command model

One registry owns each command's name, argument schema, handler, and short help. The wire tool stays compact with a command enum and an `args` object. The registry parses command-specific arguments once at the MCP boundary. Dispatch has no duplicate string switch.

```ts
type CommandSpec<TArgs, TResult> = Readonly<{
  schema: z.ZodType<TArgs>; help: string;
  run(args: TArgs, target: TargetSelector, ctx: OperationContext): Promise<TResult>;
}>;
const commandSpecs = {
  click_by_text: commandSpec(ClickByTextSchema, 'Click the first matching label', clickByText),
  fill_input: commandSpec(FillInputSchema, 'Fill one input', fillInput)
} as const satisfies Record<string, CommandSpec<unknown, unknown>>;

type ElectronCommandName = keyof typeof commandSpecs;

async function executeCommand(
  input: { command: ElectronCommandName; args: unknown; target: TargetSelector },
  ctx: OperationContext
): Promise<ToolPayload>;
```

Registration, validation, dispatch, and help derive from `commandSpecs`, so they cannot drift. The wire `args` schema is less descriptive than a large `oneOf`, but it keeps `tools/list` small. The help tool exposes one exact schema on demand. This decision follows `principle-model-the-domain` and `principle-type-system-discipline`.

## Transport and lifecycle

HTTP uses `createMcpHandler(buildServer, { legacy: 'reject', responseMode: 'json' })`. `toNodeHandler` from `@modelcontextprotocol/node` wraps it once. `localhostHostValidation` and `localhostOriginValidation` run first. Only `POST /mcp` reaches MCP. `GET /health` stays outside MCP and reports static identity plus readiness.

Stdio uses `serveStdio(() => buildServer(services), { legacy: 'reject' })` from `@modelcontextprotocol/server/stdio`. It never constructs `StdioServerTransport` directly. Both entries opt into `server/discover`, per-request metadata, required result types, and strict version checks. This decision follows `principle-redesign-from-first-principles` and `principle-migrate-callers-then-delete-legacy-apis`.

Shutdown stops accepting work, awaits `handler.close()`, closes `ElectronGateway`, closes the project store, then closes the Node server. Every CDP or Playwright operation receives an `AbortSignal` and owns its connection with `try/finally`. No WebSocket, browser, page, timeout, or listener outlives its operation.

## Explicit project state

`ProjectStore` is injected. There is no singleton and no `setDefaultProject`. HTTP factories share the store handle, not a mutable registry snapshot. The file implementation reloads before mutation, takes an interprocess lock, writes a temporary file, and atomically replaces `~/.debug-electron-mcp.json`. Reads return immutable copies. This decision follows `principle-separate-before-serializing-shared-state` and `principle-boundary-discipline`.

## Discovery and compact results

Discovery probes selected ports concurrently with a bounded worker count and one timeout budget. It sorts results by port and target ID. A 250 ms process-local cache may coalesce identical scans. The cache stores no client or protocol state.

```ts
function discoverElectronApps(
  ports: readonly DevToolsPort[],
  options: { concurrency: number; timeoutMs: number; signal?: AbortSignal }
): Promise<readonly ElectronApp[]>;

type ToolPayload<T extends object = object> = {
  content: [{ type: 'text'; text: string }]; structuredContent: { ok: true } & T;
} | {
  content: [{ type: 'text'; text: string }];
  structuredContent: { ok: false; error: ToolError };
  isError: true;
};
```

Text content never carries pretty JSON. Lists omit duplicate prose fields. Screenshot metadata carries path, dimensions, target, and byte count. Only `delivery: 'inline'` adds image content.

## Module map

```text
src/cli.ts                    parses arguments and chooses one transport
src/mcp/server.ts             owns buildServer, registration, and cache hints
src/mcp/results.ts            builds compact typed results
src/mcp/http.ts               owns createMcpHandler, Node guards, and shutdown
src/mcp/stdio.ts              owns strict serveStdio
src/electron/commands.ts      owns commandSpecs, validation, help, and dispatch
src/electron/discovery.ts     owns concurrent probing and stable sorting
src/electron/gateway.ts       owns CDP and Playwright resource lifecycles
src/projects/store.ts         owns ProjectStore and its file implementation
scripts/check-package-age.mjs enforces the seven-day policy
scripts/measure-mcp.mjs       measures list cost and request latency
```

Delete `src/serve.ts`, `src/create-server.ts`, `src/handlers.ts`, `src/tools.ts`, and `src/schemas.ts` after callers move. Fold useful command generators into `src/electron/commands.ts`. Delete unreachable `src/utils/logs.ts`, `src/utils/electron-process.ts`, and `src/utils/project.ts`. Remove `@modelcontextprotocol/sdk`, `zod-to-json-schema`, `ajv`, `ajv-formats`, `electron`, `jest`, and `ts-jest` after import and script checks prove them unused. Move `@types/ws` to development dependencies. Keep `ws`, `playwright`, Zod 4, Vitest, and the build toolchain.

## Package maturity lever

Pin `@modelcontextprotocol/server@2.0.0` and `@modelcontextprotocol/node@2.0.0`. Raise the runtime floor to Node 20. `scripts/check-package-age.mjs` reads registry metadata for every direct dependency, ignores prereleases, and rejects any selected version published less than seven full days before the run. It writes a review table without changing files. `deps:update:mature` applies only passing versions. CI runs `deps:check:mature` against the lockfile. This decision follows `principle-build-the-lever`.

## Measurement and verification

`scripts/measure-mcp.mjs` launches the built server and a v2 client pinned to `2026-07-28`. It verifies `server/discover`, `tools/list`, and one tool call over HTTP and stdio. It asserts that `initialize`, missing modern headers, `Mcp-Session-Id`, `GET /mcp`, and a 2025 revision fail.

```ts
interface McpBenchmark {
  commit: string; toolsListBytes: number; toolsListTokens: number;
  httpDiscoverP50Ms: number; httpToolsListP50Ms: number;
  stdioToolsListP50Ms: number; coldDiscoveryP50Ms: number;
  warmDiscoveryP50Ms: number;
}
```

Use one pinned tokenizer and 30 measured iterations after five warmups. Use fixed mock CDP endpoints for discovery. Save raw samples. Run the bundled Electron demo after deterministic checks. This decision follows `principle-prove-it-works`.

## Candidate decision

Choose the per-request server factory with a compact command registry. It hides protocol selection, schema generation, routing, lifecycle, and caching behind `buildServer`. Callers supply only project and operation data. The interface is deeper than the current low-level handlers and removes every v1 construction path.

## Tradeoffs accepted

- We accept a breaking protocol cut in exchange for one strict 2026 behavior.
- We accept one on-demand help call for uncommon command details in exchange for a much smaller `tools/list`.
- We accept an interprocess file lock in exchange for retaining the JSON registry safely.
- We accept fresh HTTP construction per request in exchange for horizontal statelessness. Shared services remain request-safe.

## Alternatives considered

### One tool per Electron command

This shape gives precise call schemas but makes `tools/list` large and turns each operation into catalog churn. It lost because every caller pays for every command.

### One long-lived server with a stateless transport

A shared `McpServer` behind `NodeStreamableHTTPServerTransport` with no session ID removes sessions but keeps the 2025 entry and misses strict `server/discover`. It lost because protocol lifecycle remains in application code.

### Generated command `oneOf`

The registry could emit one exact union for every command. This maximizes schema guidance but repeats the full manual in each uncached list. Keep it only if measurement shows that on-demand help materially increases call errors.

## Open questions and risks

- Will target hosts support strict 2026, or does this require a major release and compatibility table?
- Can an older installed version write the registry without the new lock?
- Which tokenizer best matches the clients this project targets?
- Do consumers require inline screenshots by default? The token-saving default breaks that behavior.

## Next implementation step

Add the v2 packages and strict transport entries first. Prove one minimal tool through HTTP and stdio before migrating the catalog.
