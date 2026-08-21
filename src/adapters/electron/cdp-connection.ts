import WebSocket from 'ws';
import type { WindowTargetOptions } from '../../application/electron-automation';
import { logger } from '../../shared/logger';
import { CdpSession, type CdpEvaluationResult } from './cdp-session';
import type { ElectronProbe } from './discovery-cache';
import type { DevToolsTarget } from './devtools-types';
import { findMainTarget, scanForElectronApps } from './discovery';

export type { CdpEvaluationResult } from './cdp-session';

/**
 * Find and connect to a running Electron application.
 * @param options - Optional targeting options to select a specific window
 * @returns The DevTools target matching the given options
 * @example
 * findElectronTarget() // first available main window
 * findElectronTarget({ targetId: 'ABC123' }) // exact ID match
 * findElectronTarget({ windowTitle: 'Settings' }) // partial title match
 */
export async function findElectronTarget(
  options?: WindowTargetOptions,
  probe: ElectronProbe = scanForElectronApps,
): Promise<DevToolsTarget> {
  logger.debug('Looking for running Electron applications...');

  const foundApps = await probe(options?.ports);

  if (foundApps.length === 0) {
    throw new Error(
      'No running Electron application found with remote debugging enabled. Start your app with: electron . --remote-debugging-port=9222',
    );
  }

  // If targetId is specified, search all apps for exact ID match
  if (options?.targetId) {
    for (const app of foundApps) {
      const match = app.targets.find((target) => target.id === options.targetId);
      if (match) {
        logger.debug(`Found target by ID "${options.targetId}" on port ${app.port}`);
        return {
          id: match.id,
          title: match.title ?? '',
          url: match.url ?? '',
          webSocketDebuggerUrl: match.webSocketDebuggerUrl ?? '',
          type: match.type,
        };
      }
    }
    throw new Error(
      `No window found with targetId "${options.targetId}". Use list_electron_windows to see available targets.`,
    );
  }

  // If windowTitle is specified, search all apps for case-insensitive partial match
  if (options?.windowTitle) {
    const searchTitle = options.windowTitle.toLowerCase();
    for (const app of foundApps) {
      const match = app.targets.find((target) => target.title?.toLowerCase().includes(searchTitle));
      if (match) {
        logger.debug(`Found target by title "${options.windowTitle}" on port ${app.port}`);
        return {
          id: match.id,
          title: match.title ?? '',
          url: match.url ?? '',
          webSocketDebuggerUrl: match.webSocketDebuggerUrl ?? '',
          type: match.type,
        };
      }
    }
    throw new Error(
      `No window found with title matching "${options.windowTitle}". Use list_electron_windows to see available targets.`,
    );
  }

  // Default: use first app's main target (backward compatible)
  const app = foundApps[0];
  const mainTarget = findMainTarget(app.targets);

  if (!mainTarget) {
    throw new Error('No suitable target found in Electron application');
  }

  logger.debug(`Found Electron app on port ${app.port}: ${mainTarget.title}`);

  return {
    id: mainTarget.id,
    title: mainTarget.title ?? '',
    url: mainTarget.url ?? '',
    webSocketDebuggerUrl: mainTarget.webSocketDebuggerUrl ?? '',
    type: mainTarget.type,
  };
}

/**
 * Execute JavaScript code in an Electron application via Chrome DevTools Protocol
 */
export async function executeInElectron(
  javascriptCode: string,
  target?: DevToolsTarget,
): Promise<CdpEvaluationResult | undefined> {
  const targetInfo = target || (await findElectronTarget());
  const webSocketDebuggerUrl = targetInfo.webSocketDebuggerUrl;
  if (!webSocketDebuggerUrl) throw new Error('No WebSocket debugger URL available');

  const session = await CdpSession.connect(webSocketDebuggerUrl);
  logger.debug(`Connected to ${targetInfo.title} via WebSocket`);
  try {
    return await session.evaluate(javascriptCode);
  } finally {
    await session.close();
  }
}

/**
 * Connect to Electron app for real-time log monitoring
 */
export async function connectForLogs(
  target?: DevToolsTarget,
  onLog?: (log: string) => void,
): Promise<WebSocket> {
  const targetInfo = target || (await findElectronTarget());

  const webSocketDebuggerUrl = targetInfo.webSocketDebuggerUrl;
  if (!webSocketDebuggerUrl) {
    throw new Error('No WebSocket debugger URL available for log connection');
  }

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(webSocketDebuggerUrl);

    ws.on('open', () => {
      logger.debug(`Connected for log monitoring to: ${targetInfo.title}`);

      // Enable Runtime and Console domains
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
      ws.send(JSON.stringify({ id: 2, method: 'Console.enable' }));

      resolve(ws);
    });

    ws.on('message', (data) => {
      try {
        const response = JSON.parse(data.toString());

        if (response.method === 'Console.messageAdded') {
          const msg = response.params.message;
          const timestamp = new Date().toISOString();
          const logEntry = `[${timestamp}] ${msg.level.toUpperCase()}: ${msg.text}`;
          onLog?.(logEntry);
        } else if (response.method === 'Runtime.consoleAPICalled') {
          const call = response.params;
          const timestamp = new Date().toISOString();
          const args =
            call.args
              ?.map((arg: { value?: unknown; description?: string }) =>
                String(arg.value ?? arg.description ?? ''),
              )
              .join(' ') || '';
          const logEntry = `[${timestamp}] ${call.type.toUpperCase()}: ${args}`;
          onLog?.(logEntry);
        }
      } catch (error) {
        logger.warn(`Failed to parse log message:`, error);
      }
    });

    ws.on('error', (error) => {
      ws.close();
      reject(new Error(`WebSocket error: ${error.message}`));
    });
  });
}
