/**
 * Take a screenshot of the running Electron application using Chrome DevTools Protocol
 */
export declare function takeScreenshot(outputPath?: string, windowTitle?: string): Promise<{
    filePath?: string;
    base64: string;
    data: string;
    error?: string;
}>;
