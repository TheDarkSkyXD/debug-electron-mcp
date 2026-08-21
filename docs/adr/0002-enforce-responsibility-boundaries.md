# ADR 0002: Enforce responsibility boundaries

## Status

Accepted on 2026-08-21.

## Context

The stateless MCP migration removed protocol sessions, but the source layout still mixed transport registration, application policy, Electron integration, and filesystem persistence. The MCP server imported concrete Electron functions, the project registry owned both allocation rules and JSON storage, and renderer command generation also opened CDP connections and formatted results. Those dependencies made request behavior harder to test and allowed future changes to reintroduce hidden process state.

The common tool catalog also remains part of every client context. Detailed command schemas are useful only when selecting an uncommon renderer command, so publishing them in both the catalog and the description tool wastes context without improving runtime validation.

## Decision

Use four responsibility layers with `src/index.ts` as the only composition root:

- `src/transport` translates MCP and HTTP requests into application calls.
- `src/application` owns command contracts, project allocation policy, and ports for Electron automation and registry storage.
- `src/adapters/electron` implements CDP, discovery, log, screenshot, and renderer-command behavior.
- `src/adapters/persistence` implements durable JSON registry storage.
- `src/shared` contains infrastructure-neutral utilities used across layers.

The application layer never imports transports or adapters. Transports depend on application ports instead of Electron, Playwright, WebSocket, filesystem, or operating-system APIs. The composition root creates concrete adapters and injects them into the server factory. Each HTTP request still receives a new MCP server instance.

`ProjectRegistry` holds no global singleton and delegates persistence through `ProjectRegistryStore`. The JSON adapter validates data at the filesystem boundary and writes through an atomic rename. Renderer command construction is a pure exhaustive function over the discriminated `ElectronCommandRequest`; connection lifecycle and result formatting live in a separate executor.

ESLint classifies source files by layer and rejects disallowed imports. Unknown source files and unknown dependencies fail lint so a new module cannot bypass the policy accidentally. CI runs lint, TypeScript 7 validation, tests, the real MCP verifier, context measurement, the seven-day direct-dependency maturity gate, and the package security audit.

The `describe_electron_command` tool accepts a compact string schema in the shared catalog and validates the name against the authoritative command enum when called. This removes the duplicated enum from `tools/list` without weakening the boundary contract.

## Consequences

Transport behavior can be tested with in-memory application ports. Electron and filesystem failures are isolated to adapters. Durable project configuration remains explicit application state rather than MCP session state. New cross-layer imports fail locally and in CI.

The measured `tools/list` response is 5,223 bytes, approximately 1,306 tokens. That is 45.3 percent fewer estimated tokens than the 9,543-byte, 2,386-token baseline. A caller pays for an exact command schema only when it invokes `describe_electron_command`.

The application-facing window result omits the CDP WebSocket URL, operating-system process data, and duplicate target counts. The smaller result exposes only data that MCP tools use. Removing the process scan also avoids one subprocess from each window-information call.

The source tree has more directories, but each directory states its responsibility and dependency direction. The large renderer switch remains intentionally centralized as a pure command compiler; CDP connection management no longer shares that module.

## Verification

`npm run lint` proves the allowed dependency graph and rejects a synthetic application-to-adapter import. `npm run typecheck` validates the discriminated command union with TypeScript 7. Unit and integration tests cover command parsing and generation, registry persistence, Electron operations, and stateless HTTP behavior. `npm run verify:mcp` and `npm run measure:mcp` exercise the built server and report protocol and context-size evidence.

The final local HTTP benchmark measured p95 response times below 5 ms for `server/discover`, `tools/list`, and `tools/call describe_electron_command`. These values cover server and loopback HTTP overhead, not renderer execution time.
