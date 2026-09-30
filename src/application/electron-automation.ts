import type { ElectronCommandRequest } from './commands';
import type {
  ElectronAction,
  ElectronActionResult,
  ProfileCapture,
  TraceCapture,
} from './electron-actions';

export interface TraceResult {
  readonly filePath: string;
  readonly bytes: number;
  readonly eventCount: number;
  readonly elapsedMs: number;
  /** Set when the trace was recorded but could not be written. */
  readonly error?: string;
}

export interface ProfileResult {
  readonly filePath: string;
  readonly bytes: number;
  readonly elapsedMs: number;
  /** Set when the profile was recorded but could not be written. */
  readonly error?: string;
}

export interface ElectronActionRunOutput {
  readonly results: readonly ElectronActionResult[];
  readonly trace?: TraceResult;
  readonly profile?: ProfileResult;
}

export interface NetworkEntry {
  readonly at: string;
  readonly event: 'request' | 'response' | 'failed' | 'finished';
  readonly requestId: string;
  readonly url?: string;
  readonly method?: string;
  readonly status?: number;
  readonly mimeType?: string;
  readonly resourceType?: string;
  readonly errorText?: string;
  readonly durationMs?: number;
}

export interface DiscoveredElectronApp {
  readonly port: number;
  readonly windowCount: number;
}

export interface WindowInfo {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly type: string;
  readonly description: string;
}

export interface ElectronWindowTarget {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly port: number;
  readonly type: string;
}

export interface ElectronWindowResult {
  readonly windows: readonly WindowInfo[];
  readonly message: string;
  readonly automationReady: boolean;
}

export interface WindowTargetOptions {
  readonly targetId?: string;
  readonly windowTitle?: string;
  readonly ports?: readonly number[];
}

export type ScreenshotFormat = 'png' | 'jpeg';

export interface ScreenshotOptions extends WindowTargetOptions {
  readonly outputPath?: string;
  readonly delivery?: 'inline' | 'file';
  readonly format?: ScreenshotFormat;
  readonly quality?: number;
  /** Capture only this element's on-screen box instead of the whole window. */
  readonly selector?: string;
}

export type ScreenshotResult =
  | {
      readonly kind: 'inline';
      readonly base64: string;
      readonly bytes: number;
      readonly mimeType: string;
    }
  | {
      readonly kind: 'file';
      readonly filePath: string;
      readonly bytes: number;
      readonly mimeType: string;
    };

export type LogType = 'console' | 'main' | 'renderer' | 'all';

export interface DiscoveredElectronProcess {
  readonly pid: number;
  readonly command: string;
  readonly debugPort?: number;
  /** Chromium helper process rather than an app main process. */
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

export interface StoppedElectronApp {
  readonly pid: number;
  readonly alreadyExited: boolean;
  readonly method: string;
}

export interface ElectronAutomation {
  close(): Promise<void>;
  discover(ports?: readonly number[]): Promise<readonly DiscoveredElectronApp[]>;
  findProcesses(): Promise<readonly DiscoveredElectronProcess[]>;
  startApp(input: StartElectronAppInput): Promise<StartedElectronApp>;
  stopApp(pid: number): Promise<StoppedElectronApp>;
  getWindowInfo(input: {
    readonly includeChildren: boolean;
    readonly ports?: readonly number[];
  }): Promise<ElectronWindowResult>;
  listWindows(input: {
    readonly includeDevTools: boolean;
    readonly ports?: readonly number[];
  }): Promise<readonly ElectronWindowTarget[]>;
  readLogs(input: {
    readonly logType: LogType;
    readonly lines: number;
    readonly ports?: readonly number[];
  }): Promise<string>;
  executeCommand(input: {
    readonly request: ElectronCommandRequest;
    readonly target?: WindowTargetOptions;
  }): Promise<string>;
  performActions(input: {
    readonly target?: WindowTargetOptions;
    readonly actions: readonly ElectronAction[];
    readonly stopOnError: boolean;
    readonly trace?: TraceCapture;
    readonly profile?: ProfileCapture;
  }): Promise<ElectronActionRunOutput>;
  /** Run one arbitrary Chrome DevTools Protocol method against a window. */
  sendCdpCommand(input: {
    readonly target?: WindowTargetOptions;
    readonly method: string;
    readonly params?: Record<string, unknown>;
  }): Promise<unknown>;
  /**
   * Read network activity observed on a window since this server opened a
   * connection to it. Empty when nothing has been recorded yet.
   */
  readNetwork(input: {
    readonly target?: WindowTargetOptions;
    readonly limit?: number;
    readonly failuresOnly?: boolean;
    /** Start recording on first use, rather than only reading past events. */
    readonly record?: boolean;
  }): Promise<{ entries: readonly NetworkEntry[]; recording: boolean; hint?: string }>;
  /**
   * Read console, log, and exception output observed on a window since this
   * server opened a connection to it.
   */
  readConsole(input: {
    readonly target?: WindowTargetOptions;
    readonly limit?: number;
    readonly level?: string;
    readonly errorsOnly?: boolean;
    /** Start recording on first use, rather than only reading past events. */
    readonly record?: boolean;
  }): Promise<{ entries: readonly ConsoleEntry[]; recording: boolean; hint?: string }>;
  takeScreenshot(options: ScreenshotOptions): Promise<ScreenshotResult>;
}

export interface ConsoleEntry {
  readonly at: string;
  readonly level: string;
  readonly text: string;
  readonly source: 'console' | 'log' | 'exception';
  readonly url?: string;
  readonly line?: number;
}
