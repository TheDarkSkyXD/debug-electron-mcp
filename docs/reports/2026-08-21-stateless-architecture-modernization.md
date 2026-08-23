# Stateless architecture modernization report

## Status

Completed on 2026-08-21. The TypeScript 7 work starts at `1d7d577`, and the architecture refactor starts at `3c3c681`. This report includes the reviewed follow-up fixes.

The MCP server uses the MCP `2026-07-28` stateless lifecycle and the native TypeScript 7 compiler. The architecture now enforces dependency direction, the common tool catalog uses 45.3 percent fewer estimated tokens than the recorded baseline, and sequential Electron calls reuse bounded adapter-local discovery and CDP resources.

## Delivered changes

### Stateless MCP runtime

- Each HTTP request creates a fresh `McpServer` through an injected server factory.
- The HTTP endpoint accepts only `POST /mcp` with MCP 2026 headers and request metadata.
- The server rejects `initialize`, streaming `GET`, and the legacy session lifecycle.
- Project registrations remain durable application configuration. They are not protocol sessions.
- Repeated `tools/list` responses are deterministic and include public cache hints.

### Enforced architecture

- `src/transport` translates MCP and HTTP requests.
- `src/application` owns command contracts, project rules, and adapter interfaces.
- `src/adapters/electron` owns Electron, CDP, Playwright, WebSocket, discovery, screenshots, and logs.
- `src/adapters/persistence` owns JSON registry storage.
- `src/index.ts` is the composition root.
- ESLint rejects reversed layer imports, unknown source classifications, platform APIs outside adapters, and Electron SDK imports in persistence.
- CI runs the architecture lint, TypeScript 7, tests, the production build, live MCP verification, measurement, the dependency-age gate, and `npm audit`.

### Context use

- The tool catalog no longer embeds the full renderer command manual.
- `describe_electron_command` returns a command schema only when a caller requests one.
- The description tool no longer duplicates the full command enum in `tools/list`. Runtime parsing still uses the authoritative enum.
- `get_electron_window_info` no longer returns OS process data, the CDP WebSocket URL, or duplicate target counts.
- Screenshot calls can return file metadata without inline PNG bytes.
- Tool results keep short text and machine-readable `structuredContent`.

### Response speed

- Electron port probes run with bounded concurrency and stable output ordering.
- Identical discovery requests share a five-second cache with a 16-entry limit and concurrent request coalescing.
- Sequential commands reuse an open CDP WebSocket for up to 15 idle seconds, with an eight-connection limit and least-recently-used eviction.
- Concurrent evaluations on one socket use distinct DevTools Protocol message IDs.
- Stale discovery is invalidated and retried only when the CDP connection cannot open. An evaluation that may have reached Electron is never replayed.
- `get_electron_window_info` no longer starts the legacy `ps aux` subprocess.
- CDP returns a validated raw evaluation result. The command executor formats that result once.
- Renderer inputs fail before Electron discovery or a CDP connection begins.
- `scripts/measure-mcp.mjs` now measures live loopback HTTP operations, discovery concurrency, catalog size, and sequential warm-path reuse.

### TypeScript and package maintenance

- `@typescript/native@7.0.2` owns `tsc` and production type validation.
- `@typescript/typescript6@6.0.2` provides the compatibility package for tools that need the compiler API. The bridge exposes TypeScript 6.0.3.
- `@boundaries/eslint-plugin@7.2.0` enforces the layer graph.
- `eslint-import-resolver-typescript@4.4.5` resolves TypeScript imports for the boundary rules.
- All 410 resolved lockfile package entries passed the seven-day minimum release-age gate on 2026-08-22. Targeted overrides prevent permissive transitive ranges from selecting releases inside the safety window.
- `npm audit` reported zero vulnerabilities.

### Legacy removal and safety fixes

- Removed the global `ProjectRegistry` singleton and the unused `src/utils/project.ts` wrapper.
- Split project rules from JSON persistence. The persistence adapter validates input and writes through an atomic rename.
- Split renderer code generation from CDP connection and result formatting.
- Replaced broad optional command arguments with a discriminated `ElectronCommandRequest` union.
- Removed the legacy process scan and provider-specific types from the application interface.
- Fixed a review finding where validation text could be evaluated as JavaScript.
- Fixed a review finding where decorated CDP strings prevented structured `eval` result parsing.
- Added complete boundary validation for DevTools target data.

## Measured results

Run `npm run build && npm run measure:mcp` to regenerate these values.

### Context size

| Measurement | Baseline | Current | Change |
| --- | ---: | ---: | ---: |
| `tools/list` bytes | 9,543 | 5,223 | -45.3% |
| Estimated `tools/list` tokens | 2,386 | 1,306 | -45.3% |
| Description characters | Not recorded | 392 | — |

The token estimate is `ceil(JSON bytes / 4)`. It is a stable budget estimate, not a model-specific tokenizer count.

### Live local HTTP response latency

Each operation used 3 warmups and 20 measured loopback requests against the production bundle.

| Operation | Median | p95 | Maximum | Response bytes |
| --- | ---: | ---: | ---: | ---: |
| `server/discover` | 2.47 ms | 3.31 ms | 6.94 ms | 291 |
| `tools/list` | 2.54 ms | 3.09 ms | 5.58 ms | 5,225 |
| `tools/call describe_electron_command` | 2.21 ms | 2.46 ms | 2.70 ms | 680 |

These values measure MCP server and local HTTP overhead. Electron command time also depends on the target app, renderer work, and CDP connection.

### Electron discovery

The controlled benchmark probes six ports with a fixed 20 ms response delay.

| Strategy | Mean response time |
| --- | ---: |
| Bounded parallel discovery | 31.56 ms |
| Serial reference | 186.93 ms |

Bounded parallel discovery is about 5.9 times faster in this benchmark.

### Sequential Electron call latency

This controlled loopback benchmark makes one cold call followed by 20 warm calls. Discovery probes six endpoints with a fixed 20 ms response delay. CDP evaluates a trivial expression against a local WebSocket server.

| Stage | Cold call | Warm median | Warm p95 | Reuse evidence |
| --- | ---: | ---: | ---: | --- |
| Electron discovery | 22.05 ms | 0.0027 ms | 0.0064 ms | 6 network probes total across all 21 scans |
| CDP evaluation | 8.49 ms | 0.1707 ms | 0.2573 ms | 1 WebSocket connection for all 21 evaluations |
| MCP `tools/call` | 69.74 ms | 2.47 ms | 5.26 ms | 1 discovery request and 1 CDP connection for 21 tool calls |

The first two rows isolate adapter overhead. The third sends real stateless HTTP `tools/call` requests through the MCP transport, with controlled local discovery and CDP endpoints. Real commands still include renderer execution time and any model time between tool calls. If the gap between calls exceeds the five-second discovery TTL or 15-second CDP idle TTL, the next call safely pays the cold-path cost again.

### Build and verification

| Check | Result |
| --- | --- |
| TypeScript 7 | Passed |
| ESLint and architecture boundaries | Passed with zero warnings |
| Prettier | Passed |
| Vitest | 8 files and 52 tests passed |
| Production bundle | 149,168 bytes |
| Live MCP verifier | Discovery, stateless calls, tool calls, structured results, headers, and legacy rejection passed |
| Resolved package age | 410 of 410 passed |
| Security audit | Zero vulnerabilities |

The production bundle is 55.0 percent smaller than the recorded 331,676-byte pre-modernization baseline.

## Review result

Two independent reviews checked repository standards and the requested behavior. The first pass found unsafe validation flow, CDP result ownership, an incomplete boundary type guard, missing platform-import enforcement, unsafe test casts, and two measurement-script errors. The implementation fixes all findings. Both reviewers reported no unresolved high, medium, or hard issues after the final pass.

The sequential-speed follow-up received the same two-axis review. Reviewers found cold-admission races, unbounded connection opening, incomplete shutdown cleanup, and adapter-only performance evidence. The fixes add atomic admission, stale-entry rechecks, active-call protection, timed and cancellable opening, independent resource cleanup, and real MCP `tools/call` measurement. The final review found no unresolved hard or medium issues.

The repeated exhaustive switches in `commands.ts` and `renderer-command-builder.ts` remain by design. TypeScript checks both against the command union, and `commandSpecs` uses `satisfies Record<ElectronCommand, CommandSpec>`.

## Verification commands

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
npm run verify:mcp
npm run measure:mcp
npm run deps:check:mature
npm audit
```

The architecture decisions are in `docs/adr/0002-enforce-responsibility-boundaries.md` and `docs/adr/0003-bound-sequential-electron-reuse.md`. Protocol research is in `docs/research/mcp-2026-release-candidate.md`.
