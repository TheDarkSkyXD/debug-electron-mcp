import type { ElectronAutomation } from '../../application/electron-automation';
import { sendCommandToElectron } from './command-executor';
import { getElectronWindowInfo, listElectronWindows, scanForElectronApps } from './discovery';
import { readElectronLogs } from './log-reader';
import { takeScreenshot } from './screenshot';

export function createElectronAutomation(): ElectronAutomation {
  return {
    discover: async (ports) =>
      (await scanForElectronApps(ports)).map(({ port, targets }) => ({
        port,
        windowCount: targets.length,
      })),
    getWindowInfo: ({ includeChildren, ports }) => getElectronWindowInfo(includeChildren, ports),
    listWindows: ({ includeDevTools, ports }) => listElectronWindows(includeDevTools, ports),
    readLogs: ({ logType, lines, ports }) => readElectronLogs(logType, lines, ports),
    executeCommand: ({ request, target }) => sendCommandToElectron(request, target),
    takeScreenshot,
  };
}
