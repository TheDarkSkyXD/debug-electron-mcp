import { execFile } from 'node:child_process';
import { promisify } from 'util';
import {
  findElectronTarget,
  connectForLogs,
  type WindowTargetOptions,
} from './electron-connection';
import type { DevToolsTarget } from './electron-discovery';
import { logger } from './logger';

export type LogType = 'console' | 'main' | 'renderer' | 'all';

/**
 * Read logs from running Electron applications
 * @param logType - Type of logs to read
 * @param lines - Number of recent lines to read
 * @param ports - Optional list of specific ports to scan
 */
export async function readElectronLogs(
  logType: LogType = 'all',
  lines: number = 100,
  ports?: number[],
): Promise<string> {
  try {
    logger.info('[MCP] Looking for running Electron applications for log access...');

    try {
      const windowOptions: WindowTargetOptions | undefined = ports ? { ports } : undefined;
      const target = await findElectronTarget(windowOptions);

      // Connect via WebSocket to get console logs
      if (logType === 'console' || logType === 'all') {
        return await getConsoleLogsViaDevTools(target, lines);
      }
    } catch {
      logger.info('[MCP] No DevTools connection found, checking system logs...');
    }

    // Fallback to system logs if DevTools not available
    return await getSystemElectronLogs(lines);
  } catch (error) {
    throw new Error(
      `Failed to read logs: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

/**
 * Get console logs via Chrome DevTools Protocol
 */
async function getConsoleLogsViaDevTools(target: DevToolsTarget, lines: number): Promise<string> {
  const logs: string[] = [];
  const ws = await connectForLogs(target, (log: string) => logs.push(log));
  try {
    ws.send(
      JSON.stringify({
        id: 99,
        method: 'Runtime.evaluate',
        params: {
          expression: `console.log("MCP log snapshot"); "snapshot"`,
          includeCommandLineAPI: true,
          awaitPromise: true,
        },
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 250));
    return logs.length > 0 ? logs.slice(-lines).join('\n') : 'No console logs available';
  } finally {
    ws.close();
  }
}

/**
 * Get system logs for Electron processes
 */
async function getSystemElectronLogs(lines: number = 100): Promise<string> {
  logger.info('[MCP] Reading system logs for Electron processes...');

  if (process.platform !== 'darwin') {
    return (
      `System Electron log fallback is unavailable on ${process.platform}. ` +
      'Start Electron with --remote-debugging-port=9222 to read a bounded console snapshot.'
    );
  }

  try {
    const execFileAsync = promisify(execFile);

    const { stdout } = await execFileAsync('ps', ['aux']);
    const electronProcesses = stdout
      .trim()
      .split('\n')
      .filter((line) => /electron/i.test(line) && !/Visual Studio Code/i.test(line));

    if (electronProcesses.length === 0) {
      return 'No Electron processes found running on the system.';
    }

    let logOutput = `Found ${electronProcesses.length} Electron process(es):\n\n`;

    electronProcesses.forEach((process, index) => {
      const parts = process.trim().split(/\s+/);
      const pid = parts[1];
      const command = parts.slice(10).join(' ');
      logOutput += `Process ${index + 1}:\n`;
      logOutput += `  PID: ${pid}\n`;
      logOutput += `  Command: ${command}\n\n`;
    });

    try {
      const { stdout: allLogContent } = await execFileAsync('log', [
        'show',
        '--last',
        '1h',
        '--predicate',
        'process == "Electron"',
        '--style',
        'compact',
      ]);
      const logContent = allLogContent.trim().split('\n').slice(-lines).join('\n');
      if (logContent) {
        logOutput += 'Recent Electron logs from system:\n';
        logOutput += '==========================================\n';
        logOutput += logContent;
      } else {
        logOutput +=
          'No recent Electron logs found in system logs. Try enabling remote debugging with --remote-debugging-port=9222 for better log access.';
      }
    } catch {
      logOutput +=
        'Could not access system logs. For detailed logging, start Electron app with --remote-debugging-port=9222';
    }

    return logOutput;
  } catch (error) {
    return `Error reading system logs: ${error instanceof Error ? error.message : String(error)}`;
  }
}
