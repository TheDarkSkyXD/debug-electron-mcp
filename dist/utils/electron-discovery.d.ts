export interface ElectronAppInfo {
    port: number;
    targets: any[];
}
export interface WindowInfo {
    id: string;
    title: string;
    url: string;
    type: string;
    description: string;
    webSocketDebuggerUrl: string;
}
/** Simplified window target info for the list_electron_windows tool */
export interface ElectronWindowTarget {
    id: string;
    title: string;
    url: string;
    port: number;
    type: string;
}
export interface ElectronWindowResult {
    platform: string;
    devToolsPort?: number;
    windows: WindowInfo[];
    totalTargets: number;
    electronTargets: number;
    processInfo?: any;
    message: string;
    automationReady: boolean;
}
/**
 * Scan for running Electron applications with DevTools enabled
 */
export declare function scanForElectronApps(): Promise<ElectronAppInfo[]>;
/**
 * Get detailed process information for running Electron applications
 */
export declare function getElectronProcessInfo(): Promise<any>;
/**
 * Find the main target from a list of targets
 */
export declare function findMainTarget(targets: any[]): any | null;
/**
 * List all available Electron window targets across all detected apps.
 * @param includeDevTools - Whether to include DevTools windows (default: false)
 * @returns Array of window targets with id, title, url, port, and type
 */
export declare function listElectronWindows(includeDevTools?: boolean): Promise<ElectronWindowTarget[]>;
/**
 * Get window information from any running Electron app
 */
export declare function getElectronWindowInfo(includeChildren?: boolean): Promise<ElectronWindowResult>;
