# Mobile MCP apples-to-apples benchmark

## Decision

Run both servers as persistent child processes over stdio on the same machine and Node runtime. The implemented benchmark uses the same `@modelcontextprotocol/client` 2.0.0 client for both. It pins modern protocol `2026-07-28` for debug-electron-mcp and selects the client's legacy negotiation mode for Mobile MCP.

Point each server at deterministic adapter behavior, then report two five-action results:

1. **Call-count matched:** five MCP calls to each server, one action per call.
2. **Best supported path:** five Mobile MCP calls against one `perform_electron_actions` call containing five Electron actions.

The first number compares per-call and server-path overhead. The second measures the latency an agent sees when it asks each product to complete the same workflow. The result is intentionally conservative for Electron: Electron still performs real HTTP discovery and WebSocket CDP traffic, while the portable Mobile fixture patches `Mobilecli.executeCommand` and excludes operating-system process startup. It is an MCP and server-path comparison, not a real-device or process-launch headline.

## Pinned upstream

The comparison target is `mobile-next/mobile-mcp` commit [`86687b17e843cf21bf98d5c7d4c07f416c7d5247`](https://github.com/mobile-next/mobile-mcp/commit/86687b17e843cf21bf98d5c7d4c07f416c7d5247), the tip of `main` observed on 2026-09-04. It is 14 commits after tag `1.0.2`. The benchmark must check the full SHA before installing or running the checkout.

Mobile MCP requires Node 20 or newer, has a lockfile, and uses `npm ci` in its documented build. Its CI currently selects Node 24. The repository does not pin an exact npm version, so the result manifest must record and hold both `node --version` and `npm --version` constant across the two builds. See the pinned [`package.json`](https://github.com/mobile-next/mobile-mcp/blob/86687b17e843cf21bf98d5c7d4c07f416c7d5247/package.json#L1-L46), [`package-lock.json`](https://github.com/mobile-next/mobile-mcp/blob/86687b17e843cf21bf98d5c7d4c07f416c7d5247/package-lock.json#L1-L12), and [build workflow](https://github.com/mobile-next/mobile-mcp/blob/86687b17e843cf21bf98d5c7d4c07f416c7d5247/.github/workflows/build.yml#L25-L40).

The runtime dependency is `@modelcontextprotocol/sdk` 1.26.0. The compiled entrypoint is `lib/index.js`, exposed as `mcp-server-mobile`. It defaults to `StdioServerTransport`; `--listen` selects the older SDK's SSE transport. The comparison should use stdio because debug-electron-mcp also supports stdio. Sources: [`package.json` dependencies](https://github.com/mobile-next/mobile-mcp/blob/86687b17e843cf21bf98d5c7d4c07f416c7d5247/package.json#L26-L35), [`package.json` binary](https://github.com/mobile-next/mobile-mcp/blob/86687b17e843cf21bf98d5c7d4c07f416c7d5247/package.json#L56-L59), and [`src/index.ts`](https://github.com/mobile-next/mobile-mcp/blob/86687b17e843cf21bf98d5c7d4c07f416c7d5247/src/index.ts#L1-L4), [`src/index.ts`](https://github.com/mobile-next/mobile-mcp/blob/86687b17e843cf21bf98d5c7d4c07f416c7d5247/src/index.ts#L72-L128).

## Mobile MCP tool catalogue

The pinned server registers 31 tools:

- Device and cloud: `mobile_list_available_devices`, `mobile_login_to_cloud_provider`, `mobile_list_remote_devices`, `mobile_allocate_remote_device`, `mobile_release_remote_device`
- Apps: `mobile_list_apps`, `mobile_get_foreground_app`, `mobile_launch_app`, `mobile_terminate_app`, `mobile_install_app`, `mobile_uninstall_app`
- Interaction and inspection: `mobile_get_screen_size`, `mobile_click_on_screen_at_coordinates`, `mobile_double_tap_on_screen`, `mobile_long_press_on_screen_at_coordinates`, `mobile_list_elements_on_screen`, `mobile_press_button`, `mobile_open_url`, `mobile_swipe_on_screen`, `mobile_type_keys`, `mobile_save_screenshot`, `mobile_take_screenshot`
- Device state and diagnostics: `mobile_set_orientation`, `mobile_set_location`, `mobile_clipboard`, `mobile_get_device_logs`, `mobile_get_orientation`, `mobile_start_screen_recording`, `mobile_stop_screen_recording`, `mobile_list_crashes`, `mobile_get_crash`

The upstream annotation test is a compact, executable inventory of every tool. It also proves there is no batch-action tool in this revision. See [`test/server-annotations.test.ts`](https://github.com/mobile-next/mobile-mcp/blob/86687b17e843cf21bf98d5c7d4c07f416c7d5247/test/server-annotations.test.ts#L10-L60).

`createMcpServer` registers each tool through a wrapper that validates the schema, calls the handler, wraps its text response, and starts a fire-and-forget PostHog request. Set `MOBILEMCP_DISABLE_TELEMETRY=1`; otherwise network scheduling contaminates the measurements. See [`src/server.ts`](https://github.com/mobile-next/mobile-mcp/blob/86687b17e843cf21bf98d5c7d4c07f416c7d5247/src/server.ts#L52-L112) and [`src/server.ts`](https://github.com/mobile-next/mobile-mcp/blob/86687b17e843cf21bf98d5c7d4c07f416c7d5247/src/server.ts#L114-L162).

## Mobile action path

The default path for a local action is:

```text
stdio request
  -> McpServer tool schema and wrapper
  -> getRobotFromDevice(device)
  -> mobilecli --version
  -> mobilecli devices
  -> new MobileDevice(device)
  -> one mobilecli action command
  -> text MCP response
```

`getRobotFromDevice` checks the CLI and enumerates devices on every tool invocation. For a non-legacy Android device it then constructs `MobileDevice`. Each `MobileDevice` method creates a command and synchronously invokes the configured executable with `execFileSync`. See [`src/server.ts`](https://github.com/mobile-next/mobile-mcp/blob/86687b17e843cf21bf98d5c7d4c07f416c7d5247/src/server.ts#L158-L224), [`src/mobile-device.ts`](https://github.com/mobile-next/mobile-mcp/blob/86687b17e843cf21bf98d5c7d4c07f416c7d5247/src/mobile-device.ts#L107-L178), and [`src/mobilecli.ts`](https://github.com/mobile-next/mobile-mcp/blob/86687b17e843cf21bf98d5c7d4c07f416c7d5247/src/mobilecli.ts#L76-L106).

In production, a single ordinary action makes three CLI process calls: version, device enumeration, and the action. The five-action workload below makes 15. The portable benchmark preserves those 15 method invocations and command arguments, but patches `Mobilecli.executeCommand`, so it does not include operating-system process creation. The benchmark asserts the command count rather than treating the fake device as an unobserved implementation detail.

The relevant handlers call `Robot.tap`, `Robot.pressButton`, `Robot.swipeFromCoordinate`, `Robot.sendKeys`, and `Robot.openUrl` directly. See [`src/server.ts`](https://github.com/mobile-next/mobile-mcp/blob/86687b17e843cf21bf98d5c7d4c07f416c7d5247/src/server.ts#L565-L755). Their default `MobileDevice` implementation maps them to `mobilecli io tap`, `io button`, `io swipe`, `io text`, and `url`. See [`src/mobile-device.ts`](https://github.com/mobile-next/mobile-mcp/blob/86687b17e843cf21bf98d5c7d4c07f416c7d5247/src/mobile-device.ts#L236-L260).

## Deterministic device doubles

### Mobile MCP

The implemented [`mobile-mcp-benchmark-server.mjs`](../../scripts/fixtures/mobile-mcp-benchmark-server.mjs) imports the built upstream `Mobilecli` class and patches only `Mobilecli.prototype.executeCommand` before creating the upstream server. Upstream's own tests replace the same method when checking command construction: [`test/mobilecli.test.ts`](https://github.com/mobile-next/mobile-mcp/blob/86687b17e843cf21bf98d5c7d4c07f416c7d5247/test/mobilecli.test.ts#L8-L18).

The patched method returns:

- `mobilecli version benchmark` for `--version`
- one online Android emulator named `benchmark-device` for `devices`
- `{"status":"ok","data":{"packageName":"benchmark.app","appName":"Benchmark"}}` for `apps foreground --device benchmark-device`
- success for the five mutation commands

The wrapper counts every command and rejects an unexpected argument vector. It uses an Android fake so `getRobotFromDevice` does not enter the iOS simulator agent-status and install path. `MOBILEMCP_LEGACY_ROBOT` remains unset and `MOBILEMCP_DISABLE_TELEMETRY=1` prevents PostHog calls.

Patching the method makes the suite portable across Windows, macOS, and Linux. It preserves upstream schema validation, the tool wrapper, `getRobotFromDevice`, version and device checks, `MobileDevice`, and action command construction. It deliberately omits `execFileSync` and process-launch cost. A later real-Android suite must measure that boundary.

### debug-electron-mcp

The implemented [`electron-mcp-benchmark-server.mjs`](../../scripts/fixtures/electron-mcp-benchmark-server.mjs) creates the real Electron automation and MCP server with an in-memory benchmark project registration. The benchmark driver supplies a local `/json` HTTP discovery server and WebSocket CDP server. This retains the production discovery cache, target selection, session pool, JSON encoding, socket traffic, and CDP packet path. The current test doubles use the same endpoint shape in [`electron-runtime-cache.test.ts`](../../tests/unit/electron-runtime-cache.test.ts).

Assert one discovery request and one CDP connection after warm-up. The five actions below produce eight CDP requests: three mouse packets, one text packet, two key packets, one wheel packet, and one navigation packet. Both the five-call and batched Electron cases should produce the same eight packets.

## Implemented benchmark

[`benchmark-mobile-parity.mjs`](../../scripts/benchmark-mobile-parity.mjs) implements the comparison. It checks out and verifies the pinned Mobile MCP commit, builds the upstream TypeScript, starts both wrappers through the same `@modelcontextprotocol/client` 2.0.0 `StdioClientTransport`, alternates measurement order, and validates every backend operation count. The client uses modern protocol pin `2026-07-28` for Electron and legacy negotiation mode for Mobile MCP.

The two fixtures have deliberately different adapter doubles because they preserve each product's server structure:

- [`electron-mcp-benchmark-server.mjs`](../../scripts/fixtures/electron-mcp-benchmark-server.mjs) runs the real Electron automation and MCP server. The driver provides fake HTTP discovery and CDP WebSocket endpoints.
- [`mobile-mcp-benchmark-server.mjs`](../../scripts/fixtures/mobile-mcp-benchmark-server.mjs) runs the upstream MCP server and `MobileDevice` path, but patches only `Mobilecli.executeCommand`. Version, device lookup, and action argument construction still execute. OS process startup does not.

The final 2026-09-04 run used 5 warm-ups and 30 alternated samples for each workload on Windows x64, Node 24.14.0. Values below are medians in milliseconds from [the raw result artifact](../../.verification/benchmarks/mobile-parity-20260904.json).

| Adapter delay | Workload                          | Electron | Mobile MCP | Electron relative speed |
| ------------- | --------------------------------- | -------: | ---------: | ----------------------: |
| 0 ms          | Tool catalogue                    |    0.604 |      1.257 |                   2.08x |
| 0 ms          | One context read                  |    0.633 |      0.324 |                   0.51x |
| 0 ms          | One coordinate click              |    0.746 |      0.357 |                   0.48x |
| 0 ms          | Five separate equivalent actions  |    2.975 |      1.410 |                   0.47x |
| 0 ms          | Electron batch versus Mobile five |    1.073 |      1.210 |                   1.13x |
| 1 ms          | Tool catalogue                    |    0.553 |      1.252 |                   2.26x |
| 1 ms          | One context read                  |    1.672 |      3.366 |                   2.01x |
| 1 ms          | One coordinate click              |    2.730 |      3.372 |                   1.24x |
| 1 ms          | Five separate equivalent actions  |   10.165 |     16.713 |                   1.64x |
| 1 ms          | Electron batch versus Mobile five |    7.380 |     16.534 |                   2.24x |

"Electron relative speed" is `mobile median / Electron median`; values below 1 mean Mobile MCP was faster. The 1 ms scenario adds one deterministic wait per adapter operation. It is useful because zero-delay Mobile calls are in-process after the method patch, while Electron still crosses sockets.

Each scenario produced exactly 701 CDP requests over one CDP connection and one discovery request, plus exactly 1,260 Mobile CLI method calls. The driver calculates these expectations from sample and warm-up counts and fails on a mismatch.

This is a conservative MCP and server-path comparison. It shows that Mobile wins small zero-I/O action dispatches, Electron wins catalogue serialization and the batched workflow, and even 1 ms of adapter work moves all interaction workloads in Electron's favor. It does not measure Mobile MCP's real `execFileSync` process creation or either product against a real app.

## Workloads

Time from writing one complete JSON-RPC request to parsing the matching complete response. Do not include process startup or protocol negotiation in these three warm measurements.

### Tool discovery

Call `tools/list` once per sample on each persistent server. Record latency, response bytes, and tool count. Do not trim descriptions or schemas. Catalogue size is part of the cost paid by an MCP client.

### One read

Read the identity of the active application:

| Server   | Tool and arguments                                                                     | Expected backend work                                   |
| -------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Mobile   | `mobile_get_foreground_app({device: "benchmark-device"})`                              | Three commands: version, devices, foreground app        |
| Electron | `send_command_to_electron({projectName: "benchmark", command: "get_title", args: {}})` | One cached target resolution and one `Runtime.evaluate` |

These responses are both small strings identifying the active app context.

### Five sequential interactions

Use the same user intent and fixed values:

| Step | Mobile MCP                                                                       | Electron action                                                              |
| ---- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1    | `mobile_click_on_screen_at_coordinates({device, x: 10, y: 20})`                  | `{kind: "click", target: {kind: "coordinates", x: 10, y: 20}}`               |
| 2    | `mobile_type_keys({device, text: "parity", submit: false})`                      | `{kind: "type_text", text: "parity"}`                                        |
| 3    | `mobile_press_button({device, button: "ENTER"})`                                 | `{kind: "press_key", key: "Enter"}`                                          |
| 4    | `mobile_swipe_on_screen({device, direction: "up", x: 10, y: 20, distance: 120})` | `{kind: "scroll", deltaY: 120, target: {kind: "coordinates", x: 10, y: 20}}` |
| 5    | `mobile_open_url({device, url: "https://example.test/"})`                        | `{kind: "open_url", url: "https://example.test/"}`                           |

For the call-count-matched result, invoke `perform_electron_actions` five times with a one-item `actions` array. For the best-path result, send all five actions in one array. Mobile MCP has no batch tool at the pinned commit, so its best supported path remains five MCP calls.

Swipe and mouse-wheel scroll are the closest available native operations, not identical input primitives. Label the fourth step that way in the result rather than implying packet-level equivalence.

## Run protocol

1. Verify the pinned Mobile MCP SHA before every run. Record the Electron Git SHA, dirty state, and runtime content hash.
2. Build Mobile MCP from its lockfile. Run the Electron source through the repository's pinned `tsx`, under the same recorded Node 24 and npm versions. Start both through `node` rather than `npx`.
3. Set `MOBILEMCP_DISABLE_TELEMETRY=1` for Mobile MCP.
4. Connect both through the MCP 2.0 client's stdio transport. Use the modern protocol pin for Electron and legacy negotiation mode for Mobile MCP. Finish negotiation before timing.
5. Warm every workload five times. Then collect 30 paired samples, alternating `electron/mobile` and `mobile/electron` order each pair.
6. Keep each server and fake backend alive for one adapter-delay scenario. Start fresh processes for the next scenario.
7. Save the environment, revisions, runtime content hash, every raw sample, median, p95, minimum, maximum, catalogue bytes, backend call count, and connection count in one JSON artifact.
8. Fail the run if a response is an MCP error, a result does not match the fixture, a backend count differs, or the Mobile MCP SHA changes.

The driver does not force garbage collection between samples. It records operating system, architecture, Node, npm, repository revisions, working-tree state, sample counts, and a SHA-256 hash of the Electron runtime and benchmark files.

## Existing upstream measurements

The pinned repository has no benchmark directory, benchmark npm script, latency test, or checked-in performance result. Its tool wrapper records handler duration for telemetry, but that clock starts inside the MCP callback. It includes the handler's device work but omits stdio framing, SDK work before the callback, response serialization, and client parsing. It is not an end-to-end benchmark. See the pinned [root tree](https://github.com/mobile-next/mobile-mcp/tree/86687b17e843cf21bf98d5c7d4c07f416c7d5247), [`package.json` scripts](https://github.com/mobile-next/mobile-mcp/blob/86687b17e843cf21bf98d5c7d4c07f416c7d5247/package.json#L13-L23), and [tool wrapper timer](https://github.com/mobile-next/mobile-mcp/blob/86687b17e843cf21bf98d5c7d4c07f416c7d5247/src/server.ts#L84-L98).

## Limits on the claim

- The servers use different MCP protocol generations. The implemented MCP 2.0 client handles both through explicit modern-pin and legacy modes. Negotiation is excluded from warm-call latency.
- Mobile MCP launches a CLI process for each check and command in production, but the portable fixture patches `Mobilecli.executeCommand` in memory. Electron retains loopback HTTP and WebSocket I/O. This favors Mobile in zero-delay action measurements, so the result is conservative for Electron and must not be presented as real adapter latency.
- The upstream repository does not pin npm exactly. Reproducibility comes from the benchmark manifest, not its package metadata.
- Five separate calls are the strict interface comparison. One Electron batch versus five Mobile calls is the workflow comparison. Publishing only the latter would hide where the speedup comes from.
- This benchmark measures local MCP and server-path overhead. The remaining apples-to-apples suite must run Mobile MCP against a real Android emulator and debug-electron-mcp against a real Electron app on the same host, with equivalent app state and user outcomes. Keep those end-to-end numbers separate from this fixture result.
