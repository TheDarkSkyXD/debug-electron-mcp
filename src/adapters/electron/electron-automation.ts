import type { ElectronAutomation } from '../../application/electron-automation';
import type { ElectronCommandExecution } from './command-executor';
import { sendCommandToElectron } from './command-executor';
import { CdpConnectionPool } from './cdp-connection-pool';
import { findElectronTarget } from './cdp-connection';
import { CdpConnectionOpenError } from './cdp-session';
import { ElectronDiscoveryCache } from './discovery-cache';
import { getElectronWindowInfo, listElectronWindows, scanForElectronApps } from './discovery';
import { readElectronLogs } from './log-reader';
import { takeScreenshot } from './screenshot';

export function createElectronAutomation(): ElectronAutomation {
  const discovery = new ElectronDiscoveryCache({ probe: scanForElectronApps });
  const connections = new CdpConnectionPool();
  const cachedProbe = (ports?: readonly number[]) => discovery.scan(ports);
  const findTarget = (options?: Parameters<typeof findElectronTarget>[0]) =>
    findElectronTarget(options, cachedProbe);
  const execution: ElectronCommandExecution = {
    evaluate: async (javascriptCode, targetOptions) => {
      let target = await findTarget(targetOptions);
      const evaluateTarget = () => {
        if (!target.webSocketDebuggerUrl) {
          throw new CdpConnectionOpenError('No WebSocket debugger URL available.');
        }
        return connections.evaluate(target.webSocketDebuggerUrl, javascriptCode);
      };

      try {
        return await evaluateTarget();
      } catch (error) {
        if (!(error instanceof CdpConnectionOpenError)) throw error;
        discovery.invalidate(targetOptions?.ports);
        target = await findTarget(targetOptions);
        return evaluateTarget();
      }
    },
  };

  return {
    close: async () => {
      discovery.clear();
      await connections.close();
    },
    discover: async (ports) =>
      (await cachedProbe(ports)).map(({ port, targets }) => ({
        port,
        windowCount: targets.length,
      })),
    getWindowInfo: ({ includeChildren, ports }) =>
      getElectronWindowInfo(includeChildren, ports, cachedProbe),
    listWindows: ({ includeDevTools, ports }) =>
      listElectronWindows(includeDevTools, ports, cachedProbe),
    readLogs: ({ logType, lines, ports }) => readElectronLogs(logType, lines, ports, findTarget),
    executeCommand: ({ request, target }) => sendCommandToElectron(request, target, execution),
    takeScreenshot: (options) => takeScreenshot(options, cachedProbe),
  };
}
