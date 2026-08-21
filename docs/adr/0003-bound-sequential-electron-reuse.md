# ADR 0003: Bound sequential Electron reuse

## Status

Accepted on 2026-08-21. This decision narrows the request-resource rule in ADR 0001.

## Context

MCP requests are stateless, but sequential Electron commands previously repeated two mechanical operations. Each command scanned the same DevTools ports and opened a new CDP WebSocket. A controlled six-port probe took about 24 to 32 ms, and a local CDP connection plus first evaluation took about 8 ms. Those costs occurred even when the next command targeted the same renderer.

Protocol statelessness does not require the process to discard replaceable caches or connection pools. It requires each request to contain the information needed to execute correctly without a protocol session or affinity to prior requests.

## Decision

One `ElectronAutomation` adapter owns two bounded runtime optimizations:

- `ElectronDiscoveryCache` caches normalized port selections for 5 seconds. It holds at most 16 selections, coalesces concurrent identical probes, returns copies, and caches no MCP request data.
- `CdpConnectionPool` retains a CDP connection for 15 seconds after use. It holds at most 8 target connections and evicts the least recently used idle connection at capacity. Admission reserves capacity before asynchronous work begins, and an active evaluation is never evicted to admit another target.

Each pooled CDP connection assigns a unique message ID to every evaluation and keeps independent pending resolvers. Concurrent calls can share a socket without sharing command state.

If a cached target cannot open a CDP connection, the adapter invalidates that discovery entry, probes again, and retries against the refreshed target. The adapter does not retry an evaluation after transmission because repeating a click, type, drag, navigation, or arbitrary `eval` could duplicate a side effect.

The pool closes a failed or remote-closed socket. Connection opening has a 10-second timeout and can be cancelled immediately during pool shutdown. Idle timers do not keep the Node.js process alive. `ElectronAutomation.close()` clears discovery data and closes every retained socket. The HTTP and stdio entry points close the adapter on `SIGINT` and `SIGTERM`, even if transport cleanup fails.

Log snapshots keep their request-owned event connection because they install temporary listeners. Playwright screenshot browsers also remain request-scoped and close in `finally`.

## Statelessness rule

No request receives or returns a cache key, connection key, session ID, or affinity token. A process restart, cache miss, eviction, or connection loss can increase latency but does not change the requested operation or its input contract. Durable project registrations remain separate application configuration.

Window-list and discovery results can be at most 5 seconds old. Command execution refreshes discovery early when a cached CDP endpoint cannot open.

## Consequences

The warm path avoids repeated HTTP discovery and WebSocket handshakes between nearby calls. Memory and socket use have fixed limits. A command after the TTL uses the cold path and refreshes both resources.

The adapter now owns concurrent mutable connection state. `CdpSession` isolates pending evaluations by message ID, while `CdpConnectionPool` is the only owner that creates, evicts, and closes sessions.

## Verification

Real local HTTP and WebSocket tests prove concurrent cold-call coalescing, hard capacity under concurrent admission, sequential reuse, concurrent evaluation, active-call protection, bounded and cancellable opening, closed-socket replacement, TTL eviction, capacity eviction, stale-target refresh, and shutdown cleanup.

`npm run measure:mcp` compares the cold and warm paths. In the review-fix run, discovery fell from 31.23 ms cold to 0.0039 ms median warm. CDP evaluation fell from 9.26 ms cold to 0.1476 ms median warm. The end-to-end MCP benchmark fell from 74.94 ms for the cold tool call to 2.88 ms median for the next 20 calls. All 21 tool calls used one discovery request and one CDP connection.
