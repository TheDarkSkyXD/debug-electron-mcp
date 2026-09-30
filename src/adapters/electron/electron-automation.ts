import type { ElectronAutomation } from '../../application/electron-automation';
import type { WindowTargetOptions } from '../../application/electron-automation';
import type { ElectronCommandExecution } from './command-executor';
import { sendCommandToElectron } from './command-executor';
import { CdpConnectionPool } from './cdp-connection-pool';
import { findElectronTarget } from './cdp-connection';
import { CdpConnectionOpenError } from './cdp-session';
import { ElectronDiscoveryCache } from './discovery-cache';
import { getElectronWindowInfo, listElectronWindows, scanForElectronApps } from './discovery';
import { ConsoleRecorder } from './console-recorder';
import { readElectronLogs } from './log-reader';
import { NetworkRecorder } from './network-recorder';
import { takeScreenshot } from './screenshot';
import { ElectronActionRunner } from './electron-action-runner';
import { findElectronProcesses, startElectronApp, stopElectronApp } from './app-lifecycle';
import type { DevToolsTarget } from './devtools-types';

/** Escape-hatch commands may block on the protocol longer than a normal action. */
const CDP_COMMAND_TIMEOUT_MS = 30_000;

export function createElectronAutomation(): ElectronAutomation {
  const discovery = new ElectronDiscoveryCache({ probe: scanForElectronApps });
  const connections = new CdpConnectionPool();
  const actions = new ElectronActionRunner({
    withSession: (url, operation) => connections.withSession(url, operation),
    // A pause leaves the target unable to answer, so the socket is retired
    // rather than left for the next caller to lease and fail on.
    invalidate: (url) => connections.invalidate(url),
  });
  // Keyed by target URL, which is also the pool's key, so a recorder cannot
  // outlive the session that feeds it: when the pool evicts the connection the
  // CDP socket closes and no more events arrive for that key.
  const recorders = new Map<string, NetworkRecorder>();
  const consoleRecorders = new Map<string, ConsoleRecorder>();
  const cachedProbe = (ports?: readonly number[]) => discovery.scan(ports);
  const findTarget = (options?: Parameters<typeof findElectronTarget>[0]) =>
    findElectronTarget(options, cachedProbe);
  const withTarget = async <Result>(
    options: WindowTargetOptions | undefined,
    operation: (target: DevToolsTarget) => Promise<Result>,
  ): Promise<Result> => {
    let target = await findTarget(options);
    try {
      return await operation(target);
    } catch (error) {
      if (!(error instanceof CdpConnectionOpenError)) throw error;
      discovery.invalidate(options?.ports);
      target = await findTarget(options);
      return operation(target);
    }
  };
  const execution: ElectronCommandExecution = {
    evaluate: (javascriptCode, targetOptions) =>
      withTarget(targetOptions, (target) => {
        if (!target.webSocketDebuggerUrl) {
          throw new CdpConnectionOpenError('No WebSocket debugger URL available.');
        }
        return connections.evaluate(target.webSocketDebuggerUrl, javascriptCode);
      }),
  };

  return {
    close: async () => {
      for (const recorder of recorders.values()) recorder.dispose();
      for (const recorder of consoleRecorders.values()) recorder.dispose();
      recorders.clear();
      consoleRecorders.clear();
      discovery.clear();
      await connections.close();
    },
    discover: async (ports) =>
      (await cachedProbe(ports)).map(({ port, targets }) => ({
        port,
        windowCount: targets.length,
      })),
    findProcesses: () => findElectronProcesses(),
    startApp: (input) => startElectronApp(input),
    stopApp: (pid) => stopElectronApp(pid),
    getWindowInfo: ({ includeChildren, ports }) =>
      getElectronWindowInfo(includeChildren, ports, cachedProbe),
    listWindows: ({ includeDevTools, ports }) =>
      listElectronWindows(includeDevTools, ports, cachedProbe),
    readLogs: ({ logType, lines, ports }) => readElectronLogs(logType, lines, ports, findTarget),
    executeCommand: ({ request, target }) => sendCommandToElectron(request, target, execution),
    performActions: async ({ actions: batch, stopOnError, target, trace, profile }) =>
      withTarget(target, (resolvedTarget) =>
        actions.run({ actions: batch, stopOnError, target: resolvedTarget, trace, profile }),
      ),
    sendCdpCommand: ({ target, method, params }) =>
      withTarget(target, (resolvedTarget) => {
        if (!resolvedTarget.webSocketDebuggerUrl) {
          throw new CdpConnectionOpenError('No WebSocket debugger URL available.');
        }
        if (!method.includes('.')) {
          throw new Error(`CDP method must be in "Domain.method" form, got "${method}".`);
        }
        return connections.withSession(resolvedTarget.webSocketDebuggerUrl, (client) =>
          client.request(method, params ?? {}, CDP_COMMAND_TIMEOUT_MS),
        );
      }),
    readConsole: async ({ target, limit, level, errorsOnly = false, record = false }) => {
      const resolved = await findTarget(target);
      const url: string | undefined = resolved.webSocketDebuggerUrl;
      if (!url) {
        throw new CdpConnectionOpenError('No WebSocket debugger URL available.');
      }
      return connections.withSession(url, async (client) => {
        let recorder = consoleRecorders.get(url);
        if (!recorder && record) {
          recorder = new ConsoleRecorder(client);
          consoleRecorders.set(url, recorder);
          await recorder.enable();
        }
        if (!recorder) {
          return {
            entries: [],
            recording: false,
            hint: 'Nothing recorded yet. Call read_console with record:true to start capturing on this window.',
          };
        }
        const entries = recorder.read(limit, level, errorsOnly);
        return {
          entries,
          recording: true,
          ...(entries.length === 0
            ? {
                hint: record
                  ? 'Recording, but nothing matched. Reproduce the failure, then read again.'
                  : 'Recording, but nothing matched this filter.',
              }
            : {}),
        };
      });
    },

    readNetwork: async ({ target, limit, failuresOnly = false, record = false }) => {
      const resolved = await findTarget(target);
      const url: string | undefined = resolved.webSocketDebuggerUrl;
      if (!url) {
        throw new CdpConnectionOpenError('No WebSocket debugger URL available.');
      }
      return connections.withSession(url, async (client) => {
        let recorder = recorders.get(url);
        if (!recorder && record) {
          recorder = new NetworkRecorder(client);
          recorders.set(url, recorder);
          await recorder.enable();
        }
        if (!recorder) {
          return {
            entries: [],
            recording: false,
            hint: 'Nothing recorded yet. Call read_network with record:true to start capturing on this window.',
          };
        }
        return {
          entries: recorder.read(limit, failuresOnly),
          recording: true,
          ...(recorder.count(failuresOnly) === 0 && failuresOnly
            ? { hint: 'No failed requests recorded on this window.' }
            : {}),
        };
      });
    },
    takeScreenshot: (options) => takeScreenshot(options, { connections, withTarget }),
  };
}
