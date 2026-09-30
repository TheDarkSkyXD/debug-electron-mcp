# Playwright lessons for the direct CDP action path

Research date: 2026-09-04

This note compares Microsoft Playwright with the direct Chrome DevTools Protocol path in `debug-electron-mcp`. It focuses on techniques that can improve action speed, correctness, and Electron coverage without restoring Playwright as a production dependency.

The sources are the official Microsoft Playwright repository and Playwright documentation. Source links use an immutable commit when they refer to implementation details.

## Version boundary

The former dependency on `playwright ^1.62.1` referred to a real Microsoft release. Microsoft published `v1.62.1` on 2026-07-30 at commit `26a9e470`. The current Playwright `main` commit inspected for this note is `46cd5008`, dated 2026-09-04. GitHub reports 271 commits and 836 changed files between the tag and that commit. [Playwright v1.62.1 release](https://github.com/microsoft/playwright/releases/tag/v1.62.1) [v1.62.1 package manifest](https://github.com/microsoft/playwright/blob/v1.62.1/packages/playwright/package.json) [v1.62.1 to main comparison](https://github.com/microsoft/playwright/compare/v1.62.1...main)

The local change removes Playwright from production and replaces `chromium.connectOverCDP()` with a pooled `CdpSession`. The relevant local code is [`cdp-session.ts`](../../src/adapters/electron/cdp-session.ts), [`cdp-connection-pool.ts`](../../src/adapters/electron/cdp-connection-pool.ts), [`electron-action-runner.ts`](../../src/adapters/electron/electron-action-runner.ts), and [`screenshot.ts`](../../src/adapters/electron/screenshot.ts).

## What changed after Playwright 1.62.1

### Skip accessibility work when the caller will discard it

Playwright found that the accessibility tree walk dominated response time on large pages. Commit `15b1aec` made snapshot capture conditional on whether the response would include it. The current backend still skips the tree walk when the response format is `none`. [performance fix](https://github.com/microsoft/playwright/commit/15b1aec478d90f0293dae7b7b6dafd494d9f0154) [current snapshot capture](https://github.com/microsoft/playwright/blob/46cd5008d12d4e1297793d921e6cc3b595e388da/packages/playwright-core/src/tools/backend/tab.ts#L416-L468)

`debug-electron-mcp` already follows the useful part of this rule. It creates a snapshot only for an explicit `snapshot` action. It does not append a snapshot after every input action. Keep that behavior.

### Replace dead shared connections by identity

Commit `2cc9f3e` clears a cached browser promise after a failed connection or a later disconnect. The callback first checks that the cached value is still the same promise. This prevents an old failure from clearing a newer connection. The next MCP call reconnects lazily. [reconnect fix](https://github.com/microsoft/playwright/commit/2cc9f3ee7fdd82feb87edb7f24af77442bdc10e2)

The local pool uses the same identity check when a connection succeeds, fails, closes, or is evicted. The new stale-target tests also cover discovery refresh before an action batch or screenshot. No design change is needed here. Add a test for a disconnect during a leased batch before considering this area complete.

### Return structured snapshots to machine callers

Commit `ea4ea1f` added a JSON accessibility snapshot to JSON-mode MCP responses. The backend avoids rendering YAML and parsing it back into data. [structured snapshot change](https://github.com/microsoft/playwright/commit/ea4ea1f658cba38ead61ab6c1cf80ce519d9366d)

The local `snapshot` action already returns objects through MCP `structuredContent`. That matches the efficient response shape. The remaining gap is snapshot quality, not serialization.

### Preserve original screenshot bytes

Commit `89c8e5d` removed model-specific image resizing from Playwright MCP. The MCP server now returns the browser's original image bytes and lets each client choose any later processing. [screenshot resolution fix](https://github.com/microsoft/playwright/commit/89c8e5da86883e2b0e06f92446b95b9c752005de)

The local direct screenshot path already returns the base64 bytes from `Page.captureScreenshot` unchanged. Keep original bytes as the default. Do not add server-side resizing to reduce MCP payload size.

### Bound connection setup and do not retain failed attempts

Commit `df01cf9` adds a deadline when a Playwright extension token makes the connection non-interactive. Its test also proves that a failed attempt is not cached and that the next tool call can try again. [extension timeout fix](https://github.com/microsoft/playwright/commit/df01cf969b22daf5cc5b7c2b588e19382c39f6fa)

`CdpSession.beginConnect()` already has a 10-second timeout, cancellation, and failed-entry removal. The larger local gap is an overall action-batch deadline. Fifty actions can each consume the full per-command timeout today.

### Guard browser-owned URLs before navigation

Commit `fb0c3ce` blocks Chromium WebUI pages that can crash an isolated CDP-created browser context. The check canonicalizes unusual spellings such as `view-source:chrome://settings`. [WebUI navigation guard](https://github.com/microsoft/playwright/commit/fb0c3cee704c11ab0d97a68e78729dcbb342ccae)

The local `open_url` action takes a stricter approach for an attached Electron renderer. It rejects `about:`, `blob:`, `chrome:`, `chrome-extension:`, `data:`, `devtools:`, `edge:`, `javascript:`, and `view-source:`. The tests cover the two schemes added after this research, `edge:` and `view-source:`. This protects the host application and should remain stricter than Playwright's isolated-browser rule. See [`electron-action-runner.test.ts`](../../tests/unit/electron-action-runner.test.ts).

### Create parent directories for requested artifacts

Commit `648a67c` creates the parent directory before writing an explicitly named screenshot or other artifact. [artifact directory fix](https://github.com/microsoft/playwright/commit/648a67c7c1261eefe4113cba2d586417d5e3f2f2)

The local screenshot path now does the same with `fs.mkdir(path.dirname(filePath), { recursive: true })`. A regression test first failed against the missing-directory behavior and now proves that an explicit nested output path succeeds. This Playwright change is covered. See [`screenshot.test.ts`](../../tests/unit/screenshot.test.ts).

### Close a transport after malformed input

Playwright's current WebSocket transport closes the connection if it receives malformed JSON or if its message callback throws. It dispatches each message in a separate `setImmediate` task to avoid transport callback reentrancy. [WebSocket transport](https://github.com/microsoft/playwright/blob/46cd5008d12d4e1297793d921e6cc3b595e388da/packages/playwright-core/src/server/transport.ts#L138-L201)

The local session now marks itself unhealthy, rejects every pending request, and terminates its socket after malformed JSON. The socket close callback evicts the session from `CdpConnectionPool`. Each pending entry also retains its CDP method, so disconnect and protocol errors identify the interrupted request. A regression test proves both eviction and method-specific failure text. See [`cdp-session.ts`](../../src/adapters/electron/cdp-session.ts) and [`electron-runtime-cache.test.ts`](../../tests/unit/electron-runtime-cache.test.ts).

Playwright's `setImmediate` delay remains a correctness choice rather than a speed improvement. Promise resolution already defers local continuations, so measure it before adding another task boundary.

## Techniques in Playwright's current implementation

### Pipeline zero-delay mouse events

For a click without a delay, Playwright creates the mouse-move, mouse-down, and mouse-up promises without awaiting each response. It then awaits them together. WebSocket message order preserves input order while removing response round trips between the commands. Delayed clicks remain sequential. [mouse click scheduling](https://github.com/microsoft/playwright/blob/46cd5008d12d4e1297793d921e6cc3b595e388da/packages/playwright-core/src/server/input.ts#L258-L288)

The local direct path now uses this pattern. `ElectronActionRunner.click()` creates the move, press, and release requests synchronously, then awaits `Promise.all`. A double click uses one move followed by press and release pairs with click counts one and two. The coordinate resolver also returns a clean `{ x, y }` object, so the internal `kind` discriminator never leaks into a CDP packet. Long press remains sequential because its duration is observable. See [`electron-action-runner.ts`](../../src/adapters/electron/electron-action-runner.ts).

Playwright's raw Chromium input also sends the current mouse-button mask, modifier mask, and pressure on relevant events. Its click move path explicitly avoids drag-detection protocol work because the move, down, and up commands must be sent together. [Chromium mouse packets](https://github.com/microsoft/playwright/blob/46cd5008d12d4e1297793d921e6cc3b595e388da/packages/playwright-core/src/server/chromium/crInput.ts#L96-L167)

The local click, hover, scroll, and long-press packets now include explicit button state. A press sends the correct left, right, or middle button mask, while move and release send `buttons: 0`. Focused unit tests assert the complete CDP parameter objects and the scheduling order.

### Send complete keyboard packets

Playwright maps a key name to `code`, `key`, `location`, virtual key codes, text, unmodified text, and auto-repeat state. It uses `rawKeyDown` when a key does not emit text. On macOS, it also maps editing shortcuts to Chromium commands. [Chromium keyboard packets](https://github.com/microsoft/playwright/blob/46cd5008d12d4e1297793d921e6cc3b595e388da/packages/playwright-core/src/server/chromium/crInput.ts#L38-L94) [keyboard state and layout](https://github.com/microsoft/playwright/blob/46cd5008d12d4e1297793d921e6cc3b595e388da/packages/playwright-core/src/server/input.ts#L35-L189)

The local `press_key` action now chooses `keyDown` when a key emits text and `rawKeyDown` when it does not. Common named keys include Enter, Escape, editing keys, navigation keys, and arrows. ASCII letters and digits receive Chromium `code` and virtual-key-code values. Packets also carry `unmodifiedText` when they emit text. Unit tests cover the packet fields, and a live Electron run confirmed that Enter triggers default form submission.

This covers common Electron shortcuts without importing Playwright's full keyboard layer. Full keyboard-layout fidelity remains open. The local descriptors do not yet cover `location`, auto-repeat, punctuation layout, international layouts, keypad distinctions, or macOS editing commands.

### Keep one deadline across an operation

Playwright's `ProgressController` computes one monotonic deadline. Every wait and protocol request races the same abort promise, and the controller exposes one `AbortSignal`. The controller also settles its completion promise in `finally`. [progress and deadline controller](https://github.com/microsoft/playwright/blob/46cd5008d12d4e1297793d921e6cc3b595e388da/packages/playwright-core/src/server/progress.ts#L34-L175)

The local batch keeps one CDP lease but gives each request a fresh 10-second timeout. Add one `timeoutMs` to `perform_electron_actions`. Compute the deadline once, pass the remaining time to each `client.request()`, stop issuing actions after cancellation, and include the failed action index in the timeout error. Do not close a shared session merely because one MCP caller cancels. Another active lease can still use that session.

### Reject every pending request when CDP closes

Playwright's `CRConnection` multiplexes sessions over one transport. Each session owns a callback map. A crash, detach, or transport close rejects every outstanding callback with a typed protocol error that retains the command name and recent browser logs. [Chromium connection and sessions](https://github.com/microsoft/playwright/blob/46cd5008d12d4e1297793d921e6cc3b595e388da/packages/playwright-core/src/server/chromium/crConnection.ts#L43-L223)

The local `CdpSession` now retains the method name in each pending entry and reports it on send, protocol, parse, and disconnect failures. Malformed input also makes the session unavailable before termination and pool eviction. Typed `timeout`, `closed`, `crashed`, and `protocol` causes remain useful because they would let the pool classify failures without matching strings. The pool must not replay an input action whose delivery is uncertain.

### Treat actionability as a separate cost

Before a locator click, Playwright requires one element that is visible, stable, enabled, and able to receive the pointer event. It retries failed checks until the operation deadline. [official actionability rules](https://playwright.dev/docs/actionability) [retry loop](https://github.com/microsoft/playwright/blob/46cd5008d12d4e1297793d921e6cc3b595e388da/packages/playwright-core/src/server/dom.ts#L317-L397) [hit-target checks](https://github.com/microsoft/playwright/blob/46cd5008d12d4e1297793d921e6cc3b595e388da/packages/injected/src/injectedScript.ts#L996-L1166)

The local selector path calls `document.querySelector()`, scrolls the first match into view, checks only for a non-empty rectangle, and clicks its center. A low-cost improvement can stay in one `Runtime.evaluate` call:

- Require exactly one match by default.
- Check `isConnected`, computed visibility, and native or ARIA disabled state.
- Check that `document.elementFromPoint()` returns the target or its descendant.
- Return a typed failure and the resolved point in one response.

Do not copy Playwright's full actionability implementation into the fast path. Stability checks need animation-frame sampling. Hit-target interception, shadow DOM retargeting, frame traversal, and retry diagnostics depend on Playwright's injected runtime and frame model. Offer deeper checks as an explicit reliable mode if users need them.

### Keep batch order, but avoid redundant boundaries

Playwright has no `page.batch()` API. An official repository issue proposing one was closed as not planned. The proposal still records sensible constraints: actions remain sequential, each action keeps actionability, intermediate MCP waits can be skipped, and the batch shares one deadline. [batch API issue](https://github.com/microsoft/playwright/issues/39437)

The local MCP batch follows the important ordering rule. It reduces MCP and target-discovery overhead without running independent UI mutations in parallel. Keep actions sequential. Pipeline only the protocol packets that form one atomic input gesture, such as a zero-delay click.

### Preserve raw screenshot speed, then add opt-in coverage

Playwright serializes screenshot jobs because its full screenshot pipeline can change CSS animations, caret rendering, masks, background color, and viewport state. Chromium capture uses `Page.captureScreenshot` with a clip, `captureBeyondViewport`, and a scale correction. [screenshot queue and cleanup](https://github.com/microsoft/playwright/blob/46cd5008d12d4e1297793d921e6cc3b595e388da/packages/playwright-core/src/server/screenshotter.ts#L199-L337) [Chromium screenshot command](https://github.com/microsoft/playwright/blob/46cd5008d12d4e1297793d921e6cc3b595e388da/packages/playwright-core/src/server/chromium/crPage.ts#L275-L299)

The local viewport PNG capture does not mutate page state, so it does not need Playwright's queue or injected cleanup. It can still add direct-CDP options for JPEG or WebP, quality, a clip, and full-page capture. Full-page capture needs `Page.getLayoutMetrics` and `captureBeyondViewport`. Element capture needs a trustworthy box from a strict selector. Preserve the current raw viewport capture as the fast default.

### Add touch as direct CDP, but treat drag as a larger feature

Playwright implements a tap as `Input.dispatchTouchEvent` start and end packets. The two requests are issued together. Its drag path is different. It tracks button state, intercepts Chromium drag events, and coordinates source and destination actionability. [Chromium touch input](https://github.com/microsoft/playwright/blob/46cd5008d12d4e1297793d921e6cc3b595e388da/packages/playwright-core/src/server/chromium/crInput.ts#L169-L188) [Chromium drag manager](https://github.com/microsoft/playwright/blob/46cd5008d12d4e1297793d921e6cc3b595e388da/packages/playwright-core/src/server/chromium/crDragDrop.ts)

A `tap` action is a small direct-CDP addition for Electron apps that use touch handlers. Drag-and-drop needs a separate design and tests. A sequence of mouse events alone does not cover HTML drag events or Chromium's drag interception.

## Adaptation status and remaining rank

| Remaining rank | Candidate                                                                           | Status      | Expected effect                                                                       | Risk          | Recommendation                                                                                        |
| -------------- | ----------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------- |
| Done           | Pipeline clean move, press, and release packets for zero-delay clicks               | Implemented | Removes CDP response waits inside each click and improves hover-sensitive correctness | Medium        | Keep the exact-packet and scheduling regression tests.                                                |
| Done           | Close malformed CDP transports and name the pending method in failures              | Implemented | Prevents reuse after protocol corruption and makes failures diagnosable               | Low           | Keep the malformed-input eviction regression.                                                         |
| Done           | Create screenshot output directories and extend navigation scheme guards            | Implemented | Prevents artifact writes from failing and blocks browser-owned navigation             | Low           | Keep the failing-before screenshot test and blocked-scheme cases.                                     |
| Done           | Add common named-key and ASCII letter and digit descriptors                         | Implemented | Supports default key behavior and common Electron shortcuts                           | Medium        | Keep the packet tests and live Enter form-submission proof.                                           |
| 1              | Add one batch deadline and cancellation signal                                      | Open        | Prevents a 50-action batch from multiplying the per-command timeout                   | Medium        | Implement before adding retries or waits.                                                             |
| 2              | Resolve selectors strictly and return fast actionability failures in one evaluation | Open        | Prevents clicks on the wrong, hidden, disabled, or covered element                    | Medium        | Implement as the default selector policy. Keep coordinate actions raw.                                |
| 3              | Add typed CDP failure categories                                                    | Open        | Removes error-string classification from retry and reporting decisions                | Low to medium | Distinguish timeout, closed, crashed, and protocol failures.                                          |
| 4              | Complete keyboard-layout fidelity                                                   | Partial     | Covers punctuation, international layouts, keypad keys, repeat, and macOS editing     | High          | Keep the current small table until demand justifies a full layout model.                              |
| 5              | Add JPEG, WebP, clip, full-page, and element screenshot options                     | Open        | Expands parity without restoring Playwright                                           | Low to medium | Keep raw viewport PNG as the default.                                                                 |
| 6              | Add `tap`, `check`, `select`, `fill`, and explicit `wait` actions                   | Open        | Covers common application controls and touch-driven Electron UI                       | Medium        | Implement each as a typed action with direct user-visible verification.                               |
| 7              | Add accurate accessible names, shadow DOM, and frame traversal                      | Open        | Makes snapshots and selector targeting closer to Playwright                           | High          | Design separately. Measure large pages before choosing CDP accessibility trees or an injected helper. |
| 8              | Add drag-and-drop and post-action navigation settling                               | Open        | Covers complex workflows                                                              | High          | Keep out of the latency-critical core until the state and cancellation model is settled.              |

## Code that does not transfer cleanly

The following Playwright code depends on capabilities that the local raw-CDP client does not own:

- Playwright locators use a selector parser, injected selector engines, utility execution worlds, shadow DOM traversal, strict-mode diagnostics, and frame adoption.
- Full actionability uses animation-frame sampling, lifecycle prechecks, hit-target interception, and a retry log under one `ProgressController`.
- `aria-ref` targets depend on Playwright's injected accessibility snapshot and its retained page objects.
- Navigation settling observes Playwright request and frame objects. The Playwright MCP backend also adds a default 500-millisecond settle wait after actions. That default conflicts with the local latency goal. [Playwright MCP completion wait](https://github.com/microsoft/playwright/blob/46cd5008d12d4e1297793d921e6cc3b595e388da/packages/playwright-core/src/tools/backend/utils.ts#L20-L50)
- Playwright's screenshot queue exists because its screenshot pipeline temporarily changes page state. The local raw capture does not.
- Browser-context reset logic applies to Playwright-owned contexts. `debug-electron-mcp` attaches to the user's Electron process and must not reset application state.

The direct-CDP path should borrow small protocol techniques, not Playwright's browser ownership model.

## Recommended next slice

The next implementation should add the batch deadline and the one-evaluation strict selector checks. Those two changes bound failure time and prevent ambiguous or covered-element clicks without adding a browser runtime. If that slice stays within the latency budget, add typed CDP failure categories next.

Benchmark the slice against the current five-action batch. Verify it in the demo Electron app with a covered element, a duplicate selector, a modifier shortcut, a batch timeout, and a forced disconnect. Keep the existing packet, navigation, malformed-transport, and nested-screenshot regressions in the same quality run.

Any code copied rather than reimplemented from the Playwright repository must retain the notices required by Playwright's Apache 2.0 license. [Playwright license](https://github.com/microsoft/playwright/blob/46cd5008d12d4e1297793d921e6cc3b595e388da/LICENSE)
