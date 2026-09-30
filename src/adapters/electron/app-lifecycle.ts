import { type ChildProcess, execFile, spawn } from 'child_process';
import * as fs from 'fs';
import { createRequire } from 'module';
import * as path from 'path';
import { promisify } from 'util';
import { logger } from '../../shared/logger';

const require = createRequire(import.meta.url);
const execFileAsync = promisify(execFile);

/**
 * A renderer helper, not the app. These are filtered out unless they carry a
 * debug port of their own, because listing them buries the main process the
 * caller actually wants to attach to.
 */
const HELPER_PROCESS_PATTERN = /--type=|zygote|gpu-process|utility/i;
const ELECTRON_COMMAND_PATTERN =
  /(?:^|[\\/\s])electron(?:\.exe)?(?:\s|$)|Electron\.app|\belectron\b/i;
const DEBUG_PORT_PATTERN = /--remote-debugging-port(?:=|\s+)(\d+)|remote-debugging-port[=:](\d+)/i;
const APP_PATH_ALLOWLIST_VARIABLE = 'DEBUG_ELECTRON_MCP_ALLOWED_ROOTS';

const COMMAND_LINE_PROBE_TIMEOUT_MS = 15_000;

export interface DiscoveredElectronProcess {
  readonly pid: number;
  readonly command: string;
  readonly debugPort?: number;
  /** Chromium helper rather than an app main process. */
  readonly helper: boolean;
}

export interface StartElectronAppInput {
  readonly appPath: string;
  readonly debugPort: number;
  readonly extraArgs?: readonly string[];
  /** Also open a Node inspector so the main process becomes a CDP target. */
  readonly inspectMain?: boolean;
}

export interface StartedElectronApp {
  readonly pid: number;
  readonly debugPort: number;
  readonly appPath: string;
  readonly args: readonly string[];
}

export interface StopElectronAppResult {
  readonly pid: number;
  readonly alreadyExited: boolean;
  readonly method: 'detached-nothing-to-stop' | 'signal' | 'taskkill';
}

function isInside(candidate: string, root: string): boolean {
  return candidate === root || candidate.startsWith(root + path.sep);
}

/**
 * Constrain `start` to directories the operator named.
 *
 * Launching runs a local binary with the caller's arguments, so an
 * unconstrained path turns this server into an arbitrary-execution primitive
 * for anything that can reach its tool surface.
 */
function assertAppPathAllowed(appPath: string): string {
  const resolved = path.resolve(appPath);
  const raw = process.env[APP_PATH_ALLOWLIST_VARIABLE]?.trim();
  if (!raw) return resolved;

  const roots = raw
    .split(/[;|]/)
    .map((entry) => path.resolve(entry.trim()))
    .filter((entry) => entry.length > 0);
  if (!roots.some((root) => isInside(resolved, root))) {
    throw new Error(
      `App path ${resolved} is outside ${APP_PATH_ALLOWLIST_VARIABLE} (${roots.join(', ')}).`,
    );
  }
  return resolved;
}

export function parseDebugPortFromCommand(command: string): number | undefined {
  const match = command.match(DEBUG_PORT_PATTERN);
  if (!match) return undefined;
  const port = Number(match[1] ?? match[2]);
  return Number.isInteger(port) ? port : undefined;
}

async function listCommandLines(): Promise<readonly DiscoveredElectronProcess[]> {
  if (process.platform === 'win32') {
    return listWindowsCommandLines();
  }
  return listPosixCommandLines();
}

async function listWindowsCommandLines(): Promise<readonly DiscoveredElectronProcess[]> {
  const script =
    'Get-CimInstance Win32_Process | ' +
    'Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress';
  try {
    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', script], {
      maxBuffer: 20 * 1024 * 1024,
      timeout: COMMAND_LINE_PROBE_TIMEOUT_MS,
    });
    const parsed: unknown = JSON.parse(stdout || '[]');
    const rows = (Array.isArray(parsed) ? parsed : [parsed]).filter(
      (row): row is { ProcessId: number; CommandLine: string } =>
        row !== null && typeof row === 'object' && 'ProcessId' in row && 'CommandLine' in row,
    );
    return rows.map((row) => ({
      pid: Number(row.ProcessId),
      command: String(row.CommandLine),
      debugPort: parseDebugPortFromCommand(String(row.CommandLine)),
      helper: HELPER_PROCESS_PATTERN.test(String(row.CommandLine)),
    }));
  } catch (error) {
    logger.warn('Windows process listing failed:', error);
    return [];
  }
}

async function listPosixCommandLines(): Promise<readonly DiscoveredElectronProcess[]> {
  try {
    const { stdout } = await execFileAsync(
      'ps',
      process.platform === 'darwin' ? ['-ax', '-o', 'pid=,command='] : ['-eo', 'pid=,args='],
      { maxBuffer: 20 * 1024 * 1024, timeout: COMMAND_LINE_PROBE_TIMEOUT_MS },
    );
    return stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .flatMap((line) => {
        const match = line.match(/^(\d+)\s+(.*)$/);
        if (!match) return [];
        const command = match[2];
        return [
          {
            pid: Number(match[1]),
            command,
            debugPort: parseDebugPortFromCommand(command),
            helper: HELPER_PROCESS_PATTERN.test(command),
          },
        ];
      });
  } catch (error) {
    logger.warn('ps process listing failed:', error);
    return [];
  }
}

/**
 * List running Electron processes and the debug port each was launched with.
 *
 * Answers "I started the app myself and lost the port" without requiring the
 * caller to have registered the project up front.
 */
export async function findElectronProcesses(): Promise<readonly DiscoveredElectronProcess[]> {
  const processes = await listCommandLines();
  return processes
    .filter((entry) => ELECTRON_COMMAND_PATTERN.test(entry.command))
    .filter((entry) => !entry.helper || entry.debugPort !== undefined)
    .map((entry) => ({
      pid: entry.pid,
      command: entry.command.length > 400 ? `${entry.command.slice(0, 400)}…` : entry.command,
      ...(entry.debugPort === undefined ? {} : { debugPort: entry.debugPort }),
      helper: entry.helper,
    }))
    .sort((left, right) => left.pid - right.pid);
}

function electronExecutablePath(): string {
  const configured = process.env.ELECTRON_PATH;
  if (configured && fs.existsSync(configured)) return configured;

  const hint =
    'The Electron binary is not installed. Set ELECTRON_PATH, or install Electron in this project.';
  try {
    const packageDirectory = path.dirname(require.resolve('electron/package.json'));
    // path.txt is the reliable source; require('electron') throws on a partial install.
    const pathFile = path.join(packageDirectory, 'path.txt');
    if (fs.existsSync(pathFile)) {
      const relative = fs.readFileSync(pathFile, 'utf8').trim();
      const candidate = path.join(packageDirectory, 'dist', relative);
      if (fs.existsSync(candidate)) return candidate;
    }
    throw new Error(hint);
  } catch (error) {
    throw new Error(error instanceof Error ? `${error.message}\n${hint}` : hint, {
      cause: error,
    });
  }
}

export async function waitForDebugPort(port: number, timeoutMs = 20_000): Promise<void> {
  const startedAt = Date.now();
  let lastError = 'no response';
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`, {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Debug port ${port} did not become ready within ${timeoutMs}ms: ${lastError}.`);
}

function automaticArgs(inspectMain: boolean): readonly string[] {
  const args: string[] = [];
  // Chromium's sandbox cannot start as root, and headless CI has no DISPLAY.
  if (
    process.env.DEBUG_ELECTRON_MCP_NO_SANDBOX === '1' ||
    process.env.CI === 'true' ||
    (process.platform === 'linux' && !process.env.DISPLAY)
  ) {
    args.push('--no-sandbox');
  }
  if (inspectMain) args.push('--inspect=0');
  return args;
}

/**
 * Launch an Electron app with remote debugging enabled.
 *
 * The child is detached from this process's lifetime on purpose: the MCP
 * server is request-scoped, so an app it owned would die with the request. The
 * caller tracks it by pid and stops it explicitly.
 */
export async function startElectronApp({
  appPath,
  debugPort,
  extraArgs = [],
  inspectMain = false,
}: StartElectronAppInput): Promise<StartedElectronApp> {
  const resolvedAppPath = assertAppPathAllowed(appPath);
  if (!fs.existsSync(resolvedAppPath)) {
    throw new Error(`App path does not exist: ${resolvedAppPath}.`);
  }

  const args = [
    `--remote-debugging-port=${debugPort}`,
    '--enable-logging',
    ...automaticArgs(inspectMain),
    ...extraArgs,
    resolvedAppPath,
  ];

  const child: ChildProcess = spawn(electronExecutablePath(), args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' },
  });

  const pid = child.pid;
  if (pid === undefined) {
    throw new Error('Electron did not start: no process id was assigned.');
  }
  child.unref();

  // Detaching a listener and immediately unref'ing means a spawn failure is
  // reported asynchronously, long after this call has returned the pid.
  const spawnFailure = new Promise<never>((_, reject) => {
    child.once('error', (error) =>
      reject(
        new Error(`Electron failed to start: ${error.message}`, {
          cause: error,
        }),
      ),
    );
    child.once('exit', (code) =>
      reject(new Error(`Electron exited with code ${code} before port ${debugPort} opened.`)),
    );
  });

  try {
    await Promise.race([waitForDebugPort(debugPort), spawnFailure]);
  } catch (error) {
    // Do not leave an orphan listening on a port the caller believes is free.
    await stopElectronApp(pid).catch(() => undefined);
    throw error;
  }

  return { pid, debugPort, appPath: resolvedAppPath, args };
}

export async function stopElectronApp(pid: number): Promise<StopElectronAppResult> {
  const alreadyExited = !isProcessAlive(pid);
  if (alreadyExited) return { pid, alreadyExited, method: 'detached-nothing-to-stop' };

  if (process.platform === 'win32') {
    // Electron spawns renderer and GPU children; killing only the parent
    // leaves them holding the debug port.
    await execFileAsync('taskkill', ['/PID', String(pid), '/T', '/F'], {
      timeout: COMMAND_LINE_PROBE_TIMEOUT_MS,
    }).catch((error: unknown) => {
      logger.warn(`taskkill failed for pid ${pid}:`, error);
    });
    return { pid, alreadyExited, method: 'taskkill' };
  }

  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      return { pid, alreadyExited: true, method: 'detached-nothing-to-stop' };
    }
  }
  return { pid, alreadyExited, method: 'signal' };
}

function isProcessAlive(pid: number): boolean {
  try {
    // Signal 0 performs the permission and existence check without delivering.
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}
