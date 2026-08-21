# MCP v2 migration candidate Sol

## Usage from the caller's view

### Start a strict stdio server

```json
{
	"mcpServers": {
		"electron": {
			"command": "npx",
			"args": ["@debugelectron/debug-electron-mcp", "--project", "my-app"]
		}
	}
}
```

The process accepts only MCP `2026-07-28`. It uses `serveStdio(factory, { legacy: 'reject' })` and writes diagnostics to stderr.

### Start a strict stateless HTTP server

```powershell
npx @debugelectron/debug-electron-mcp serve --port 3100
```

Clients send each request to `POST http://127.0.0.1:3100/mcp`. Every request includes the MCP method headers and the `2026-07-28` request metadata envelope. The MCP endpoint rejects `initialize`, `Mcp-Session-Id`, GET, DELETE, and legacy requests. No request depends on an earlier request.

### Call a tool with an explicit project handle

```json
{
	"name": "send_command_to_electron",
	"arguments": {
		"projectName": "my-app",
		"command": "wait",
		"args": { "selector": ".ready", "timeout": 5000 }
	}
}
```

The project registry remains persisted application data. `projectName` resolves to a registered DevTools port. It is not a protocol session. A `--project` value becomes an immutable server-wide default captured by the factory. Multi-project callers send `projectName` explicitly.

### Consume a compact result

```json
{
	"content": [{ "type": "text", "text": "2 Electron windows" }],
	"structuredContent": {
		"windows": [
			{ "id": "A1", "title": "Main", "url": "file:///app/index.html", "port": 9222 }
		]
	}
}
```

Machines consume `structuredContent`. The text block is a short model-facing summary. File screenshot mode returns a path without an image block. Inline mode returns the image without a path.

### Keep dependencies current without accepting fresh releases

```powershell
npm run deps:mature:check
npm run deps:mature:update
```

The check selects the newest stable direct dependency version published at least seven full days before the run's UTC cutoff. It fails if the lockfile uses a younger release or lags behind the mature target. The update command installs the selected exact versions and refreshes the lockfile. CI runs the check on pull requests and on a weekly schedule.

### Measure the change

```powershell
npm run benchmark:mcp -- --label before --output .audit/benchmarks/before.json
npm run benchmark:mcp -- --label after --output .audit/benchmarks/after.json
npm run benchmark:mcp:compare -- .audit/benchmarks/before.json .audit/benchmarks/after.json
```

The benchmark drives the built server through real stdio and HTTP transports. It records exact UTF-8 bytes and exact `o200k_base` tokens for `server/discover`, `tools/list`, and representative tool results. It also records cold and warm latency samples, p50, p95, and failures for scoped and unscoped discovery.

## Problem

The current HTTP server stores transports by `Mcp-Session-Id` and waits for `initialize`. The stdio entry connects a v1 transport directly. A process-global default project leaks between server instances. Tool schema, TypeScript command arguments, and prose descriptions disagree. Unscoped discovery waits on 22 ports in sequence. Results repeat machine data as decorated text. Log follow and screenshot connections have incomplete lifecycles. Dead modules and unused packages hide the active path.

The migration must remove protocol state without deleting useful application state. It must reduce prompt cost and latency in ways that a repeatable runtime benchmark can prove.

## Shape and rationale

Use one cheap `McpServer` factory over a shared application environment. HTTP calls the factory once per request through `createMcpHandler`. Stdio calls the same factory once per connection through `serveStdio`. Both entries set `legacy: 'reject'`.

The data shapes come first.

```ts
type ProjectName = string & { readonly __brand: 'ProjectName' };
type DevToolsPort = number & { readonly __brand: 'DevToolsPort' };
type ProjectRecord = Readonly<{
	name: ProjectName;
	port: DevToolsPort;
	windowTitlePattern?: string;
}>;
interface ProjectRegistry {
	resolve(name: ProjectName): ProjectRecord | undefined;
	list(): readonly ProjectRecord[];
	register(input: RegisterProjectInput): Promise<ProjectRecord>;
	unregister(name: ProjectName): Promise<boolean>;
}
type CommandRequest =
	| { command: 'get_title'; args?: never }
	| { command: 'wait'; args: { selector?: string; text?: string; duration?: number; timeout?: number } }
	| { command: 'drag'; args: { startSelector: string; endSelector: string } }
	| { command: 'get_attribute'; args: { selector: string; attribute: string } }
	| { command: 'type'; args: { text: string; selector?: string; slowly?: boolean } }
	| { command: 'eval'; args: { code: string } }
	| OtherExistingCommandVariants;
type ProjectScope =
	| { kind: 'explicit'; projectName: ProjectName }
	| { kind: 'default'; projectName: ProjectName }
	| { kind: 'discovery' };
type ScreenshotResult =
	| { kind: 'inline'; mimeType: 'image/png'; base64: string; bytes: number }
	| { kind: 'file'; path: string; bytes: number };
interface ApplicationEnvironment {
	readonly projects: ProjectRegistry;
	readonly electron: ElectronGateway;
	readonly defaultProjectName?: ProjectName;
}
interface ElectronGateway {
	listWindows(scope: ProjectScope, signal: AbortSignal): Promise<readonly ElectronWindow[]>;
	run(command: CommandRequest, target: WindowTarget, signal: AbortSignal): Promise<CommandResult>;
	screenshot(input: ScreenshotRequest, signal: AbortSignal): Promise<ScreenshotResult>;
	readLogs(input: LogSnapshotRequest, signal: AbortSignal): Promise<LogSnapshot>;
}
```

`CommandRequest` is the source for input validation, inferred TypeScript types, generated JSON Schema, examples, and dispatch. Each variant admits only the arguments that its handler reads. `ScreenshotResult` prevents file and inline payloads from coexisting. `ProjectScope` distinguishes explicit project state from unscoped discovery.

The public construction interface stays small.

```ts
interface ServerFactoryOptions {
	readonly projects: ProjectRegistry;
	readonly electron: ElectronGateway;
	readonly defaultProjectName?: ProjectName;
}
function createMcpServer(options: ServerFactoryOptions): McpServer {
	throw new Error('not implemented');
}

function startHttpServer(options: HttpServerOptions): Promise<CloseHandle> {
	throw new Error('not implemented');
}

function startStdioServer(options: StdioServerOptions): CloseHandle {
	throw new Error('not implemented');
}

function discoverElectronApps(
	ports: readonly DevToolsPort[],
	options: { concurrency: number; timeoutMs: number; signal: AbortSignal },
): Promise<readonly ElectronApp[]> {
	throw new Error('not implemented');
}
```

`createMcpServer` constructs `new McpServer(identity, { cacheHints })` with a public, long-lived `tools/list` hint. It registers a frozen tuple of tool definitions in declared order. Each definition owns its Zod v4 input schema, output schema, short description, and handler. The SDK validates boundary data and emits JSON Schema. Internal functions receive typed values and do not parse again.

HTTP creates one `createMcpHandler(factory, { legacy: 'reject', responseMode: 'json' })`. The Node adapter wraps `handler.fetch` with `toNodeHandler`. The plain HTTP mount runs the SDK's localhost Host and Origin checks before the adapter. Health remains a separate GET endpoint and reports process health only. It does not report sessions.

Stdio creates one `serveStdio(factory, { legacy: 'reject' })` handle. Shutdown closes the handle. HTTP shutdown stops intake, awaits `handler.close()`, then closes the Node listener.

Port discovery uses a bounded worker pool and preserves input port order in the returned array. Scoped requests probe one port. Unscoped requests probe all configured ports under one deadline. Project status checks call the same batch operation once instead of invoking discovery inside a loop.

Log reading is a bounded snapshot. The migration deletes `follow`. A later continuous-log feature must use `subscriptions/listen` and an explicit application handle. Screenshot and WebSocket operations use `try/finally`, cancellation, and one close owner.

## Module map

```text
src/index.ts                    CLI parsing and composition root
src/create-server.ts            McpServer factory and deterministic registration
src/tools/index.ts              Frozen ordered tool-definition tuple
src/tools/electron-command.ts   Command union, schema, handler, structured result
src/tools/windows.ts            Window schemas, handlers, structured results
src/tools/screenshot.ts         Screenshot schema and exclusive result variants
src/tools/logs.ts               Bounded log snapshot tool
src/tools/projects.ts           Explicit project registry tools
src/electron/gateway.ts         ElectronGateway implementation and CDP lifecycle
src/electron/discovery.ts       Bounded parallel port discovery
src/project-registry.ts         Persisted project records and atomic updates
src/serve.ts                    Strict HTTP mount and shutdown
scripts/mature-dependencies.mjs Seven-day selection, check, and update
scripts/benchmark-mcp.mts       Real transport token and latency benchmark
tests/integration/mcp-v2-*      HTTP and stdio protocol conformance paths
```

Delete `src/utils/electron-process.ts`, `src/utils/logs.ts`, and `src/utils/project.ts`. Remove unused direct dependencies after an import and runtime audit. Replace `@modelcontextprotocol/sdk`, Zod 3, and `zod-to-json-schema` with stable `@modelcontextprotocol/server` v2, `@modelcontextprotocol/node` v2, and Zod 4. Keep `@modelcontextprotocol/client` only as a development dependency for exact transport tests. Raise Node to 20 or later.

## Verification contract

The migration is complete only when all checks pass.

1. An HTTP `server/discover` request succeeds without an earlier request.
2. A second HTTP request succeeds on a fresh server instance and carries no session header.
3. `initialize`, a legacy request, GET `/mcp`, DELETE `/mcp`, and `Mcp-Session-Id` fail deterministically.
4. `Mcp-Method` and `Mcp-Name` mismatches fail through the SDK adapter.
5. A spawned stdio process accepts `2026-07-28` and rejects the legacy opening.
6. Every advertised command example parses and reaches the matching command variant.
7. The bundled Electron demo passes window, command, screenshot, and log snapshot calls through both transports.
8. Forced failures close every browser and WebSocket handle.
9. Repeated `tools/list` output is byte-identical and returns a public positive TTL.
10. The comparison report shows catalog tokens, representative result tokens, and latency before and after.
11. `npm ci`, build, lint, unit tests, integration tests, package audit, and package-maturity checks pass.

## Whole-shape alternatives

### Chosen. Shared application environment with per-request MCP instances

Both transports use one `McpServer` factory. Shared project persistence and short discovery caches sit behind application interfaces. Protocol instances own no durable state. This design hides protocol negotiation, schema conversion, cache fields, and transport cleanup behind the SDK and three construction functions.

### Rejected. Raw protocol router with hand-written handlers

A custom JSON-RPC router could minimize SDK allocations and expose one request function to HTTP and stdio. It loses because this repository would own envelope validation, discovery, result types, method headers, legacy rejection, and future protocol changes. The small caller interface would hide a large amount of duplicated protocol code with no measured payoff.

### Rejected. One long-lived MCP server shared by HTTP and stdio

A singleton server looks cheaper because registrations run once. It breaks HTTP request isolation and makes request metadata, cancellation, and shutdown shared mutable state. It also diverges from `createMcpHandler`'s per-request factory contract. Precompute immutable tool metadata if construction cost appears in the benchmark. Do not share the protocol instance.

## Tradeoffs accepted

- We accept a fresh `McpServer` per HTTP request in exchange for strict isolation and SDK-supported scaling.
- We accept explicit `projectName` on HTTP calls in exchange for removing connection identity and sticky routing.
- We accept a named tokenizer development dependency in exchange for reproducible token counts under one documented encoding.
- We accept registry persistence in a stateless protocol server because projects are explicit application data, not transport state.
- We accept bounded parallel probes instead of unlimited `Promise.all` in exchange for predictable socket pressure.

## Risks and open questions

- Does the project registry need atomic rename and write semantics before concurrent HTTP mutations are safe?
- What positive `tools/list` TTL balances a release-static catalog with clients that keep old data after a server upgrade?
- Which current command variants earn continued support after usage and tests identify dead commands?
- Does the benchmark environment need a fixed port fixture to keep p95 discovery comparisons stable across machines?
- Will an exact `o200k_base` metric match the primary clients, or should the report include a second named encoding?

## Synthesis decision

This candidate selects the shared application environment with per-request MCP instances. It rejects raw routing because it duplicates the protocol. It rejects a shared MCP singleton because it reintroduces request coupling. The parent Arena process owns the final base selection and graft record.

## Next implementation step

Capture the v1 benchmark, run the official SDK codemod as a reviewable mechanical aid, then delete the session transport and dead modules before building the strict v2 factory.

## Principles that shaped the design

Foundational Thinking made `CommandRequest`, `ProjectScope`, and `ScreenshotResult` precede module boundaries. Redesign from First Principles removed the v1 lifecycle instead of wrapping it. Subtract Before You Add put session and dead-code deletion before new adapters. Model the Domain replaced loose command arguments with variants. Boundary Discipline and Type System Discipline made Zod v4 registration the only external parser. Laziness Protocol and Minimize Reader Load kept the public construction interface to three functions. Exhaust the Design Space forced comparison with raw routing and a shared singleton. Build the Lever produced the package-maturity and benchmark scripts as required design artifacts. Encode Lessons in Structure moved package age and token budgets into repeatable checks. Make Operations Idempotent requires registry and dependency updates to converge after retries. Prove It Works defined real HTTP, stdio, and Electron verification instead of compile-only evidence.
