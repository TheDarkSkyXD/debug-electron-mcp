export type LogType = 'console' | 'main' | 'renderer' | 'all';
export interface LogEntry {
    timestamp: string;
    level: string;
    message: string;
    source: 'console' | 'system';
}
/**
 * Read logs from running Electron applications
 */
export declare function readElectronLogs(logType?: LogType, lines?: number, follow?: boolean): Promise<string>;
