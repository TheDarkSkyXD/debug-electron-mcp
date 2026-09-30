# ADR 0006: Bounded observability recording and batch-scoped profiling

## Status

Accepted

## Context

Three gaps remained after the capability port in ADR 0005.

Renderer output was visible only as a process log snapshot. A console error that had already scrolled past, or a failed request the application swallowed, left no trace to inspect. An agent debugging a blank window could read the DOM and see nothing, with no way to ask what the page had actually tried to load.

CPU profiling was absent. Traces recorded in ADR 0005 showed what happened, but not where the time went within a frame.

Live console streaming was listed as a deferred item in ADR 0001, pending a protocol subscription model.

Widening the default discovery range to cover the whole project-registry allocation, as ADR 0005 required, raised a question about probe cost that had been safe to ignore at twenty-two ports.

## Decision

Add two bounded recorders, one tool each, three prompts, batch-scoped profiling, and measure the probe budget rather than guess at it.

`ConsoleRecorder` and `NetworkRecorder` attach protocol listeners when the caller first passes `record: true` and keep a 200-entry ring each. A recorder is keyed by target URL, which is also the connection pool's key, so a recorder cannot outlive the connection that feeds it: when the pool retires a connection the socket closes and no further events arrive. Nothing captured outlives its session, which matters because request URLs routinely carry tokens.

Live streaming is not implemented. MCP 2026-07-28's server event union carries only `tools_list_changed`, `prompts_list_changed`, `resources_list_changed`, and `resource_updated`; there is no channel for an arbitrary message, so a console event has nowhere to be pushed. Recording is polled instead. The deferral in ADR 0001 is satisfied only in part, and this records that honestly rather than claiming the subscription model arrived.

`Profiler.start` and `Profiler.stop` are scoped to one `perform_electron_actions` batch, alongside the ADR 0005 trace, and share its output-path guard. The profiler starts after the trace so its own setup cost is not attributed to the measured interaction. Both captures can run in one batch.

Three prompts are registered. A prompt is a canned message, so it is stateless by construction and costs nothing when unused.

`pause` retires the connection. A paused renderer answers no protocol request, so a pooled socket left in place would be handed to the next caller and fail. `resume` deliberately does not await its reply, because a paused target will not send one until execution continues and awaiting it would block the batch until timeout.

Discovery concurrency rises from 6 to 24 and the probe timeout stays at one second. Measured: fifty refused ports complete in about 30ms, so the one-second budget is only ever spent on a port that accepted and then stalled. Widening the range is therefore affordable by overlapping concurrent stalls, not by shortening the budget and turning a slow answer into a wrong one.

## Consequences

- An agent can start recording, reproduce a fault, and read the console, exception stacks, and network activity afterwards, including failures the application swallowed.
- Recording must be requested explicitly. A read with nothing recorded returns an empty result and a hint rather than silently looking like "no errors", which would be a misleading answer for the blank-window case this exists to solve.
- Console and network output is polled, not pushed. An agent watching a live interaction must poll; it cannot be handed events as they happen.
- A trace or profile covers one batch. A wider window requires reproducing more of the interaction inside that batch.
- A paused window is left paused, and its connection is gone. `resume` works on a fresh connection.

## Verification

Unit tests assert the network recorder distinguishes a 4xx from a 2xx, records transport error text, returns the newest entries for a limit, drops the oldest past its bound, and stops recording after dispose. Console tests assert argument flattening, that an object argument is stringified rather than printed as `[object Object]`, that a circular payload degrades to a marker instead of throwing, that a thrown exception keeps its stack and its first frame, and that `Log.entryAdded` lines are not adjusted while stack-frame lines are. Profiling tests assert the exact `Profiler` call order, that the profile is written, that action results survive a refused profile path, and that a trace and a profile in one batch start in that order. A discovery test allocates the full registry range and asserts every allocated port is probed; it fails against the previous twenty-two-port list.
