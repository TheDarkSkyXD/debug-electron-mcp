# Stateless architecture modernization report

## Status

Completed on 2026-08-21. The TypeScript 7 work starts at `1d7d577`, and the architecture refactor starts at `3c3c681`. This report includes the reviewed follow-up fixes.

The MCP server uses the MCP `2026-07-28` stateless lifecycle and the native TypeScript 7 compiler. The architecture now enforces dependency direction, and the common tool catalog uses 45.3 percent fewer estimated tokens than the recorded baseline.

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
- `get_electron_window_info` no longer starts the legacy `ps aux` subprocess.
- CDP returns a validated raw evaluation result. The command executor formats that result once.
- Renderer inputs fail before Electron discovery or a CDP connection begins.
- `scripts/measure-mcp.mjs` now measures live loopback HTTP operations as well as discovery concurrency and catalog size.

### TypeScript and package maintenance

- `@typescript/native@7.0.2` owns `tsc` and production type validation.
- `@typescript/typescript6@6.0.2` provides the compatibility package for tools that need the compiler API. The bridge exposes TypeScript 6.0.3.
- `@boundaries/eslint-plugin@7.2.0` enforces the layer graph.
- `eslint-import-resolver-typescript@4.4.5` resolves TypeScript imports for the boundary rules.
- All 31 direct dependency entries passed the seven-day minimum release-age gate on 2026-08-21.
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
| `server/discover` | 2.92 ms | 4.82 ms | 5.60 ms | 291 |
| `tools/list` | 2.86 ms | 4.87 ms | 5.78 ms | 5,225 |
| `tools/call describe_electron_command` | 2.38 ms | 3.86 ms | 4.10 ms | 680 |

These values measure MCP server and local HTTP overhead. Electron command time also depends on the target app, renderer work, and CDP connection.

### Electron discovery

The controlled benchmark probes six ports with a fixed 20 ms response delay.

| Strategy | Mean response time |
| --- | ---: |
| Bounded parallel discovery | 31.62 ms |
| Serial reference | 186.64 ms |

Bounded parallel discovery is about 5.9 times faster in this benchmark.

### Build and verification

| Check | Result |
| --- | --- |
| TypeScript 7 | Passed |
| ESLint and architecture boundaries | Passed with zero warnings |
| Prettier | Passed |
| Vitest | 7 files and 37 tests passed |
| Production bundle | 133,790 bytes |
| Live MCP verifier | Discovery, stateless calls, tool calls, structured results, headers, and legacy rejection passed |
| Direct dependency age | 31 of 31 passed |
| Security audit | Zero vulnerabilities |

The production bundle is 59.7 percent smaller than the recorded 331,676-byte pre-modernization baseline.

## Review result

Two independent reviews checked repository standards and the requested behavior. The first pass found unsafe validation flow, CDP result ownership, an incomplete boundary type guard, missing platform-import enforcement, unsafe test casts, and two measurement-script errors. The implementation fixes all findings. Both reviewers reported no unresolved high, medium, or hard issues after the final pass.

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

The architecture decision is in `docs/adr/0002-enforce-responsibility-boundaries.md`. Protocol research is in `docs/research/mcp-2026-release-candidate.md`.
