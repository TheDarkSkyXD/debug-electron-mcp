import { ToolInput } from './schemas';
export declare enum ToolName {
    SEND_COMMAND_TO_ELECTRON = "send_command_to_electron",
    TAKE_SCREENSHOT = "take_screenshot",
    READ_ELECTRON_LOGS = "read_electron_logs",
    GET_ELECTRON_WINDOW_INFO = "get_electron_window_info",
    LIST_ELECTRON_WINDOWS = "list_electron_windows"
}
export declare const tools: {
    name: ToolName;
    description: string;
    inputSchema: ToolInput;
}[];
