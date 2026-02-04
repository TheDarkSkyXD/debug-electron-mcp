import { ChildProcess } from 'child_process';
export declare let electronProcess: ChildProcess | null;
export declare let electronLogs: string[];
/**
 * Set the current Electron process reference
 */
export declare function setElectronProcess(process: ChildProcess | null): void;
/**
 * Get the current Electron process reference
 */
export declare function getElectronProcess(): ChildProcess | null;
/**
 * Add a log entry to the Electron logs
 */
export declare function addElectronLog(log: string): void;
/**
 * Get all Electron logs
 */
export declare function getElectronLogs(): string[];
/**
 * Clear all Electron logs
 */
export declare function clearElectronLogs(): void;
/**
 * Reset the Electron process state
 */
export declare function resetElectronProcess(): void;
