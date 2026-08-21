import type { ElectronCommandRequest } from './commands';

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

export interface ScreenshotOptions extends WindowTargetOptions {
  readonly outputPath?: string;
  readonly delivery?: 'inline' | 'file';
}

export type ScreenshotResult =
  | { readonly kind: 'inline'; readonly base64: string; readonly bytes: number }
  | { readonly kind: 'file'; readonly filePath: string; readonly bytes: number };

export type LogType = 'console' | 'main' | 'renderer' | 'all';

export interface ElectronAutomation {
  discover(ports?: readonly number[]): Promise<readonly DiscoveredElectronApp[]>;
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
  takeScreenshot(options: ScreenshotOptions): Promise<ScreenshotResult>;
}
