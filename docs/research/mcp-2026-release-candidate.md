# MCP 2026-07-28 release-candidate research

Research date: 2026-08-20. This note uses only Model Context Protocol, TypeScript SDK, GitHub, and npm sources.

## Status and scope

The release-candidate post was published on 2026-05-21. It says the final `2026-07-28` specification would ship on 2026-07-28, and the official specification now identifies `2026-07-28` as the active revision. The candidate therefore describes the final revision's intended break, while the specification changelog records the final wire changes since `2025-11-25`. [Release-candidate post](https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/) [2026-07-28 specification](https://modelcontextprotocol.io/specification/2026-07-28) [official changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog)

## Stateless protocol and lifecycle

`initialize` and `notifications/initialized` are removed. Each request instead carries its protocol version and client capabilities in `_meta`. Clients should also send `clientInfo` per request, and servers should return `serverInfo` in each result's `_meta`. A version mismatch returns `UnsupportedProtocolVersionError`. [Official changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog)

`server/discover` replaces initialization as the up-front capability and identity probe. Servers must implement it. A client may call it before any other request for version selection, and may use it as a stdio backward-compatibility probe. [Official changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog)

The protocol-level session and the `Mcp-Session-Id` HTTP header are removed. `tools/list`, `resources/list`, and `prompts/list` no longer vary by connection. A stateful application keeps state with an explicit server-minted handle, such as a `browser_id`, which the caller passes back in later tool arguments. [Official changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog) [release-candidate explanation](https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/)

Server-to-client input is no longer a server-originated JSON-RPC request. A handler returns an `InputRequiredResult`, and the client retries the original request with `inputResponses` and the echoed `requestState`. The specification requires a `resultType` on every result. [Official changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog)

## Transport behavior

The standard bindings are stdio and Streamable HTTP. Stdio carries newline-delimited messages over a client-launched subprocess. Streamable HTTP uses a POST to one MCP endpoint for each message, with a JSON response or a request-scoped SSE response stream. [Transport overview](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports)

The protocol no longer permits server-originated JSON-RPC requests. A transport carries client requests and notifications to the server, then server responses and notifications to the client. [Transport overview](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports)

Streamable HTTP requests now require `Mcp-Method` and `Mcp-Name` headers. Servers reject a header that disagrees with the JSON-RPC body. The revision also removes the HTTP GET endpoint, `resources/subscribe`, and `resources/unsubscribe`. `subscriptions/listen` is the replacement long-lived POST-response stream for opted-in change notifications. [Official changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog)

The revision removes SSE event IDs, `Last-Event-ID`, resumability, and message redelivery. When an SSE response stream fails, the client must issue a new request with a new ID. [Official changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog)

`ping`, `logging/setLevel`, and `notifications/roots/list_changed` are removed. Log level moves to `io.modelcontextprotocol/logLevel` in request `_meta`. [Official changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog)

## Performance and operations

Stateless requests remove the protocol requirement for sticky routing and a shared session store. The release-candidate post says a server can run behind a round-robin load balancer and route on `Mcp-Method` without body inspection. [Release-candidate post](https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/)

`tools/list`, `prompts/list`, `resources/list`, `resources/read`, and `resources/templates/list` now return `ttlMs` and `cacheScope`. The fields let clients cache responses and reduce polling. Servers should return `tools/list` in deterministic order to improve cache hits, including LLM prompt-cache hits. [Official changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog)

The TypeScript SDK v2 release lazily builds each protocol revision's wire-schema set on first validation and memoizes it. Importing the client or server package therefore avoids eagerly constructing both frozen schema graphs. The release notes do not publish a timing or memory measurement. [SDK v2 release](https://github.com/modelcontextprotocol/typescript-sdk/releases/tag/%40modelcontextprotocol%2Fserver%402.0.0)

## Breaking changes and deprecations

The breaking protocol changes are the removed handshake and session, the per-request metadata envelope, the new `server/discover` RPC, the replacement of push-style server requests with `input_required` retries, the new subscription model, removed SSE recovery, and the removed RPCs listed above. [Official changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog)

Tool schemas now support JSON Schema 2020-12 composition, conditionals, and references. `structuredContent` can be any JSON value. A missing resource now returns JSON-RPC `-32602`, replacing MCP's `-32002`. [Official changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog)

Roots, sampling, and logging are deprecated rather than removed. The published lifecycle policy requires at least twelve months between deprecation and possible removal. HTTP+SSE is also Deprecated, with Streamable HTTP as its replacement. [Release-candidate post](https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/) [official changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog)

SDK v2 is a package split. The v1 `@modelcontextprotocol/sdk` package becomes `@modelcontextprotocol/client`, `@modelcontextprotocol/server`, and `@modelcontextprotocol/core`, with separate Node and framework adapters. V2 requires Node.js 20 or later. [v2 migration guide](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/migration/upgrade-to-v2.md)

The v2 release also makes `DiscoverResult.serverInfo` unavailable and makes `RequestMetaEnvelope.clientInfo` optional. Code reads server identity from result `_meta` or `getServerVersion()`. The same release adds CommonJS builds alongside ESM and moves shared schema modules into `@modelcontextprotocol/core`. [SDK v2 release](https://github.com/modelcontextprotocol/typescript-sdk/releases/tag/%40modelcontextprotocol%2Fserver%402.0.0)

## TypeScript SDK and npm evidence

All listed v2 packages published `2.0.0` on 2026-07-27 between 23:55:16 and 23:55:22 UTC. The TypeScript SDK's GitHub release page records the same `@modelcontextprotocol/server@2.0.0` release at 23:55 on 2026-07-27. [npm client metadata](https://registry.npmjs.org/@modelcontextprotocol%2Fclient) [npm server metadata](https://registry.npmjs.org/@modelcontextprotocol%2Fserver) [npm core metadata](https://registry.npmjs.org/@modelcontextprotocol%2Fcore) [npm adapters and codemod metadata](https://registry.npmjs.org/@modelcontextprotocol%2Fnode) [SDK release](https://github.com/modelcontextprotocol/typescript-sdk/releases/tag/%40modelcontextprotocol%2Fserver%402.0.0)

| Package | Latest on 2026-08-20 | npm publish time in UTC | Primary evidence |
| --- | --- | --- | --- |
| `@modelcontextprotocol/client` | `2.0.0` | 2026-07-27 23:55:22.113 | [npm metadata](https://registry.npmjs.org/@modelcontextprotocol%2Fclient) |
| `@modelcontextprotocol/server` | `2.0.0` | 2026-07-27 23:55:22.239 | [npm metadata](https://registry.npmjs.org/@modelcontextprotocol%2Fserver) |
| `@modelcontextprotocol/server-legacy` | `2.0.0` | 2026-07-27 23:55:20.932 | [npm metadata](https://registry.npmjs.org/@modelcontextprotocol%2Fserver-legacy) |
| `@modelcontextprotocol/core` | `2.0.0` | 2026-07-27 23:55:21.808 | [npm metadata](https://registry.npmjs.org/@modelcontextprotocol%2Fcore) |
| `@modelcontextprotocol/node` | `2.0.0` | 2026-07-27 23:55:17.622 | [npm metadata](https://registry.npmjs.org/@modelcontextprotocol%2Fnode) |
| `@modelcontextprotocol/express` | `2.0.0` | 2026-07-27 23:55:17.260 | [npm metadata](https://registry.npmjs.org/@modelcontextprotocol%2Fexpress) |
| `@modelcontextprotocol/fastify` | `2.0.0` | 2026-07-27 23:55:16.463 | [npm metadata](https://registry.npmjs.org/@modelcontextprotocol%2Ffastify) |
| `@modelcontextprotocol/hono` | `2.0.0` | 2026-07-27 23:55:16.925 | [npm metadata](https://registry.npmjs.org/@modelcontextprotocol%2Fhono) |
| `@modelcontextprotocol/codemod` | `2.0.0` | 2026-07-27 23:55:18.961 | [npm metadata](https://registry.npmjs.org/@modelcontextprotocol%2Fcodemod) |
| `@modelcontextprotocol/sdk` | `1.30.0` | 2026-07-27 17:56:01.640 | [npm metadata](https://registry.npmjs.org/@modelcontextprotocol%2Fsdk) |

The final v2 packages were about 23 days old on the 2026-08-20 research date. They were published a few minutes before the 2026-07-28 specification date. The `2.0.0-beta.5` prereleases were published on 2026-07-21, exactly seven days before the final specification date. [npm client metadata](https://registry.npmjs.org/@modelcontextprotocol%2Fclient) [final-specification date](https://modelcontextprotocol.io/specification/2026-07-28)

The phrase "at least only 7 days old from release date" is ambiguous. Under a requirement that a package be at least seven days old on 2026-08-20, stable v2 qualifies. Under a requirement that a package have been available at least seven days before the final specification date, stable v2 does not qualify, but `2.0.0-beta.5` does. Under a requirement that a package ship no later than seven days after the final specification date, stable v2 qualifies. [npm client metadata](https://registry.npmjs.org/@modelcontextprotocol%2Fclient) [final-specification date](https://modelcontextprotocol.io/specification/2026-07-28)

## Applicability to this repository

This repository declares `@modelcontextprotocol/sdk` with the range `^1.0.0`. That range cannot select the separate v2 packages. [Repository manifest](../../package.json) [v2 migration guide](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/migration/upgrade-to-v2.md)

The HTTP entry currently imports the v1 `StreamableHTTPServerTransport`, detects `initialize`, creates and stores transports by session ID, and calls `connect` for each session. Those responsibilities conflict with the 2026 protocol's removed handshake and protocol-level session. [Current HTTP entry](../../src/serve.ts) [official changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog)

The stdio entry currently uses the v1 `StdioServerTransport` and `server.connect`. The final specification continues to define stdio, but version negotiation now uses the per-request model and `server/discover`. [Current stdio entry](../../src/index.ts) [transport overview](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports) [official changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog)
