# Fast Electron interaction design

## Problem

The warm command path already takes 2.50 ms at the MCP boundary and 0.1222 ms inside the pooled CDP connection. Three slower paths remain. Screenshots create and close a Playwright CDP connection for every call. One MCP call can execute only one renderer command. Common pointer and keyboard actions inject large JavaScript programs instead of using CDP input commands.

The first release must preserve every current tool. It must also keep MCP requests stateless. Reusable discovery and CDP resources remain private, bounded process state.

## Usage

One new tool executes an ordered action list against one resolved window.

```json
{
  "projectName": "demo",
  "actions": [
    { "kind": "snapshot", "maxElements": 100 },
    { "kind": "click", "target": { "kind": "selector", "selector": "#email" } },
    { "kind": "type_text", "text": "ada@example.com" },
    { "kind": "press_key", "key": "Enter" },
    { "kind": "scroll", "deltaY": 500 }
  ]
}
```

`take_screenshot` keeps its current request and response shape. Its implementation uses the same pooled CDP connection as actions.

## Shape

`ElectronAction` is a discriminated union. The transport parses each variant with Zod before the application receives it.

```ts
type ActionTarget =
  | Readonly<{ kind: 'coordinates'; x: number; y: number }>
  | Readonly<{ kind: 'selector'; selector: string }>;

type ElectronAction =
  | Readonly<{ kind: 'snapshot'; maxElements?: number }>
  | Readonly<{ kind: 'click'; target: ActionTarget; button?: MouseButton }>
  | Readonly<{ kind: 'double_click'; target: ActionTarget; button?: MouseButton }>
  | Readonly<{ kind: 'long_press'; target: ActionTarget; durationMs?: number }>
  | Readonly<{ kind: 'hover'; target: ActionTarget }>
  | Readonly<{ kind: 'scroll'; deltaX?: number; deltaY: number; target?: ActionTarget }>
  | Readonly<{ kind: 'type_text'; text: string; selector?: string }>
  | Readonly<{ kind: 'press_key'; key: string; modifiers?: readonly KeyModifier[] }>
  | Readonly<{ kind: 'open_url'; url: string }>
  | Readonly<{ kind: 'command'; command: ElectronCommand; args: unknown }>;

type ElectronActionResult =
  | Readonly<{ index: number; kind: ElectronAction['kind']; ok: true; value: unknown }>
  | Readonly<{ index: number; kind: ElectronAction['kind']; ok: false; error: string }>;
```

The application port adds one method.

```ts
interface ElectronAutomation {
  performActions(input: {
    target?: WindowTargetOptions;
    actions: readonly ElectronAction[];
    stopOnError: boolean;
  }): Promise<readonly ElectronActionResult[]>;
}
```

`CdpSession.request(method, params)` owns message IDs, timeouts, response parsing, and protocol errors. `evaluate()` becomes a typed wrapper over `request()`. `CdpConnectionPool.withSession(url, operation)` holds one lease for the whole batch. It prevents capacity eviction between actions and hides the concrete session from application code.

`ElectronActionRunner` resolves the DevTools target once. It then executes actions in order through the leased client. Selector targets use one small bounding-box evaluation before the CDP input command. Coordinate targets skip DOM work. `snapshot` returns a compact list with role, name, value, enabled state, bounds, and a reusable selector.

`takeScreenshot` selects the target through the existing discovery path and calls `Page.captureScreenshot` through the pool. File delivery decodes the returned base64 and writes the same `ScreenshotResult` shape as before.

## Module map

- `src/application/electron-actions.ts` owns the action types and schemas.
- `src/application/electron-automation.ts` owns the application port.
- `src/adapters/electron/cdp-session.ts` owns generic CDP requests.
- `src/adapters/electron/cdp-connection-pool.ts` owns bounded leases.
- `src/adapters/electron/electron-action-runner.ts` maps typed actions to CDP commands.
- `src/adapters/electron/electron-automation.ts` wires target resolution, actions, and screenshots.
- `src/adapters/electron/screenshot.ts` owns screenshot delivery and filesystem output.
- `src/transport/mcp-server.ts` owns the new tool schema and response mapping.
- `scripts/measure-mcp.mjs` proves latency, connection reuse, and catalog size.

## Synthesis decision

Candidate A is the base. The cross-judge scored it 8 out of 10. Candidate B scored 4 out of 10 because its public `open`, `run`, and `close` lifecycle exposed request affinity and stale-session failure modes.

The design keeps Candidate B's useful idea inside the adapter. The pool may retain bounded target resources, but callers never receive a session identifier. The tuple instruction format was rejected because object variants produce clearer JSON and better Zod errors. A screenshot cache was rejected because a stale image is worse than the capture cost for debugging.

## Tradeoffs accepted

- We accept one richer tool schema in exchange for one MCP round trip per workflow.
- We accept sequential action execution in exchange for deterministic side effects and result ordering.
- We accept selector resolution through renderer JavaScript because CDP input commands need viewport coordinates.
- We keep screenshots separate from action batches because inline image content needs the MCP content channel, not a nested structured result.
- We mark URL navigation open-world, allow network, file, and application schemes, and reject executable or privileged browser schemes.
- We keep app launch, process control, recording, crash dumps, and arbitrary filesystem APIs out of this release. Each feature needs a separate security and ownership design.

## Verification

Tests must prove the following facts:

- Invalid action variants fail at the MCP boundary.
- One batch performs one discovery and opens one CDP connection.
- Actions and results keep request order.
- `stopOnError` stops after the first failed action.
- Two screenshots reuse one CDP connection and call `Page.captureScreenshot` twice.
- The existing screenshot request and response contract does not change.
- The warm MCP median does not exceed the 2.50 ms baseline by more than benchmark noise.
- The complete `tools/list` response stays below the Mobile MCP reference size of 24,781 bytes.

## Next implementation step

Generalize `CdpSession` from evaluation-only pending calls to typed protocol requests, then build the pool lease on that contract.
