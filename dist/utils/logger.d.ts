export declare enum LogLevel {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3
}
export declare class Logger {
    private static instance;
    private level;
    constructor(level?: LogLevel);
    static getInstance(): Logger;
    setLevel(level: LogLevel): void;
    error(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    info(message: string, ...args: any[]): void;
    debug(message: string, ...args: any[]): void;
    isEnabled(level: LogLevel): boolean;
}
export declare const logger: Logger;
