import type {
  ElectronWindowResult,
  ElectronWindowTarget,
  WindowInfo,
} from '../../application/electron-automation';
import { logger } from '../../shared/logger';
import type { ElectronProbe } from './discovery-cache';
import type { DevToolsTarget, ElectronAppInfo } from './devtools-types';

/**
 * Scan for running Electron applications with DevTools enabled
 * @param ports - Optional list of specific ports to scan. When provided, only these ports are checked.
 *                When omitted, scans the default hardcoded port ranges.
 */
const DEFAULT_PORTS = [
  9200, 9201, 9202, 9203, 9204, 9205, 9222, 9223, 9224, 9225, 9300, 9301, 9302, 9303, 9304, 9305,
  9400, 9401, 9402, 9403, 9404, 9405,
] as const;
const DISCOVERY_CONCURRENCY = 6;

function isDevToolsTarget(value: unknown): value is DevToolsTarget {
  if (value === null || typeof value !== 'object') return false;
  const target = value;

  return (
    'id' in target &&
    typeof target.id === 'string' &&
    'type' in target &&
    typeof target.type === 'string' &&
    (!('title' in target) || typeof target.title === 'string') &&
    (!('url' in target) || typeof target.url === 'string') &&
    (!('description' in target) || typeof target.description === 'string') &&
    (!('webSocketDebuggerUrl' in target) || typeof target.webSocketDebuggerUrl === 'string')
  );
}

async function scanPort(port: number): Promise<ElectronAppInfo | undefined> {
  try {
    const response = await fetch(`http://localhost:${port}/json`, {
      signal: AbortSignal.timeout(1000),
    });
    if (!response.ok) return undefined;
    const body: unknown = await response.json();
    if (!Array.isArray(body)) return undefined;
    const targets = body.filter(isDevToolsTarget).filter((target) => target.type === 'page');
    return targets.length > 0 ? { port, targets } : undefined;
  } catch {
    return undefined;
  }
}

async function mapBounded<T, R>(
  items: readonly T[],
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await mapper(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(DISCOVERY_CONCURRENCY, items.length) }, worker));
  return results;
}

export async function scanForElectronApps(ports?: readonly number[]): Promise<ElectronAppInfo[]> {
  logger.debug('Scanning for running Electron applications...');
  const scanned = await mapBounded(ports ?? DEFAULT_PORTS, scanPort);
  return scanned
    .filter((app): app is ElectronAppInfo => app !== undefined)
    .sort((left, right) => left.port - right.port)
    .map((app) => ({
      ...app,
      targets: [...app.targets].sort((left, right) => left.id.localeCompare(right.id)),
    }));
}

/**
 * Find the main target from a list of targets
 */
export function findMainTarget(targets: readonly DevToolsTarget[]): DevToolsTarget | null {
  return (
    targets.find((target) => target.type === 'page' && !target.title?.includes('DevTools')) ||
    targets.find((target) => target.type === 'page') ||
    null
  );
}

/**
 * List all available Electron window targets across all detected apps.
 * @param includeDevTools - Whether to include DevTools windows (default: false)
 * @param ports - Optional list of specific ports to scan
 * @returns Array of window targets with id, title, url, port, and type
 */
export async function listElectronWindows(
  includeDevTools: boolean = false,
  ports?: readonly number[],
  probe: ElectronProbe = scanForElectronApps,
): Promise<ElectronWindowTarget[]> {
  const foundApps = await probe(ports);
  const windows: ElectronWindowTarget[] = [];

  for (const app of foundApps) {
    for (const target of app.targets) {
      // Filter out DevTools windows unless explicitly requested
      if (!includeDevTools && target.url && target.url.startsWith('devtools://')) {
        continue;
      }
      windows.push({
        id: target.id,
        title: target.title || '',
        url: target.url || '',
        port: app.port,
        type: target.type || 'page',
      });
    }
  }

  return windows.sort((left, right) => left.port - right.port || left.id.localeCompare(right.id));
}

/**
 * Get window information from any running Electron app
 * @param includeChildren - Whether to include child/DevTools windows
 * @param ports - Optional list of specific ports to scan
 */
export async function getElectronWindowInfo(
  includeChildren: boolean = false,
  ports?: readonly number[],
  probe: ElectronProbe = scanForElectronApps,
): Promise<ElectronWindowResult> {
  try {
    const foundApps = await probe(ports);

    if (foundApps.length === 0) {
      return {
        windows: [],
        message: 'No Electron applications found with remote debugging enabled',
        automationReady: false,
      };
    }

    // Use the first found app
    const app = foundApps[0];
    const windows: WindowInfo[] = app.targets.map((target) => ({
      id: target.id,
      title: target.title ?? '',
      url: target.url ?? '',
      type: target.type,
      description: target.description || '',
    }));

    return {
      windows: includeChildren
        ? windows
        : windows.filter((w: WindowInfo) => !w.title.includes('DevTools')),
      message: `Found running Electron application with ${windows.length} windows on port ${app.port}`,
      automationReady: true,
    };
  } catch (error) {
    logger.error('Failed to scan for applications:', error);
    return {
      windows: [],
      message: `Failed to scan for Electron applications: ${
        error instanceof Error ? error.message : String(error)
      }`,
      automationReady: false,
    };
  }
}
