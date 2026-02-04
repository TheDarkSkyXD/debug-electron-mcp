import { z } from 'zod';
export declare const CommandArgsSchema: z.ZodObject<{
    selector: z.ZodOptional<z.ZodString>;
    text: z.ZodOptional<z.ZodString>;
    value: z.ZodOptional<z.ZodString>;
    placeholder: z.ZodOptional<z.ZodString>;
    message: z.ZodOptional<z.ZodString>;
    code: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    value?: string | undefined;
    code?: string | undefined;
    message?: string | undefined;
    text?: string | undefined;
    selector?: string | undefined;
    placeholder?: string | undefined;
}, {
    value?: string | undefined;
    code?: string | undefined;
    message?: string | undefined;
    text?: string | undefined;
    selector?: string | undefined;
    placeholder?: string | undefined;
}>;
export declare const SendCommandToElectronSchema: z.ZodObject<{
    command: z.ZodString;
    args: z.ZodOptional<z.ZodObject<{
        selector: z.ZodOptional<z.ZodString>;
        text: z.ZodOptional<z.ZodString>;
        value: z.ZodOptional<z.ZodString>;
        placeholder: z.ZodOptional<z.ZodString>;
        message: z.ZodOptional<z.ZodString>;
        code: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        value?: string | undefined;
        code?: string | undefined;
        message?: string | undefined;
        text?: string | undefined;
        selector?: string | undefined;
        placeholder?: string | undefined;
    }, {
        value?: string | undefined;
        code?: string | undefined;
        message?: string | undefined;
        text?: string | undefined;
        selector?: string | undefined;
        placeholder?: string | undefined;
    }>>;
    targetId: z.ZodOptional<z.ZodString>;
    windowTitle: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    command: string;
    windowTitle?: string | undefined;
    args?: {
        value?: string | undefined;
        code?: string | undefined;
        message?: string | undefined;
        text?: string | undefined;
        selector?: string | undefined;
        placeholder?: string | undefined;
    } | undefined;
    targetId?: string | undefined;
}, {
    command: string;
    windowTitle?: string | undefined;
    args?: {
        value?: string | undefined;
        code?: string | undefined;
        message?: string | undefined;
        text?: string | undefined;
        selector?: string | undefined;
        placeholder?: string | undefined;
    } | undefined;
    targetId?: string | undefined;
}>;
export declare const TakeScreenshotSchema: z.ZodObject<{
    outputPath: z.ZodOptional<z.ZodString>;
    windowTitle: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    outputPath?: string | undefined;
    windowTitle?: string | undefined;
}, {
    outputPath?: string | undefined;
    windowTitle?: string | undefined;
}>;
export declare const ReadElectronLogsSchema: z.ZodObject<{
    logType: z.ZodOptional<z.ZodEnum<["console", "main", "renderer", "all"]>>;
    lines: z.ZodOptional<z.ZodNumber>;
    follow: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    logType?: "console" | "main" | "renderer" | "all" | undefined;
    lines?: number | undefined;
    follow?: boolean | undefined;
}, {
    logType?: "console" | "main" | "renderer" | "all" | undefined;
    lines?: number | undefined;
    follow?: boolean | undefined;
}>;
export declare const GetElectronWindowInfoSchema: z.ZodObject<{
    includeChildren: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    includeChildren?: boolean | undefined;
}, {
    includeChildren?: boolean | undefined;
}>;
export declare const ListElectronWindowsSchema: z.ZodObject<{
    includeDevTools: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    includeDevTools?: boolean | undefined;
}, {
    includeDevTools?: boolean | undefined;
}>;
export type ToolInput = {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
};
