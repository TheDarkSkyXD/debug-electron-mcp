import { WindowTargetOptions } from './electron-connection';
export interface CommandArgs {
    selector?: string;
    text?: string;
    value?: string;
    placeholder?: string;
    message?: string;
    code?: string;
}
/**
 * Enhanced command executor with improved React support.
 * @param command - The command to execute
 * @param args - Command-specific arguments
 * @param windowOptions - Optional window targeting (targetId or windowTitle)
 */
export declare function sendCommandToElectron(command: string, args?: CommandArgs, windowOptions?: WindowTargetOptions): Promise<string>;
/**
 * Enhanced click function with better React support
 */
export declare function clickByText(text: string): Promise<string>;
/**
 * Enhanced input filling with React state management
 */
export declare function fillInput(searchText: string, value: string, selector?: string): Promise<string>;
/**
 * Enhanced select option with proper event handling
 */
export declare function selectOption(value: string, selector?: string, text?: string): Promise<string>;
/**
 * Get comprehensive page structure analysis
 */
export declare function getPageStructure(): Promise<string>;
/**
 * Get enhanced element analysis
 */
export declare function findElements(): Promise<string>;
/**
 * Execute custom JavaScript with error handling
 */
export declare function executeCustomScript(code: string): Promise<string>;
/**
 * Get debugging information about page elements
 */
export declare function debugElements(): Promise<string>;
/**
 * Verify current form state and validation
 */
export declare function verifyFormState(): Promise<string>;
export declare function getTitle(): Promise<string>;
export declare function getUrl(): Promise<string>;
export declare function getBodyText(): Promise<string>;
