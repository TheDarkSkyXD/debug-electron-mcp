import WebSocket from 'ws';
export interface DevToolsTarget {
    id: string;
    title: string;
    url: string;
    webSocketDebuggerUrl: string;
    type: string;
}
export interface CommandResult {
    success: boolean;
    result?: any;
    error?: string;
    message: string;
}
/** Options for targeting a specific Electron window */
export interface WindowTargetOptions {
    /** CDP target ID (exact match) */
    targetId?: string;
    /** Window title (case-insensitive partial match) */
    windowTitle?: string;
}
/**
 * Find and connect to a running Electron application.
 * @param options - Optional targeting options to select a specific window
 * @returns The DevTools target matching the given options
 * @example
 * findElectronTarget() // first available main window
 * findElectronTarget({ targetId: 'ABC123' }) // exact ID match
 * findElectronTarget({ windowTitle: 'Settings' }) // partial title match
 */
export declare function findElectronTarget(options?: WindowTargetOptions): Promise<DevToolsTarget>;
/**
 * Execute JavaScript code in an Electron application via Chrome DevTools Protocol
 */
export declare function executeInElectron(javascriptCode: string, target?: DevToolsTarget): Promise<string>;
/**
 * Connect to Electron app for real-time log monitoring
 */
export declare function connectForLogs(target?: DevToolsTarget, onLog?: (log: string) => void): Promise<WebSocket>;
