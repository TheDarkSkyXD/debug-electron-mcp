export interface DevToolsTarget {
  readonly id: string;
  readonly title?: string;
  readonly url?: string;
  readonly type: string;
  readonly description?: string;
  readonly webSocketDebuggerUrl?: string;
}

export interface ElectronAppInfo {
  readonly port: number;
  readonly targets: readonly DevToolsTarget[];
}
