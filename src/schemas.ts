import { z } from 'zod';

// Command arguments schema for better type safety and documentation
export const CommandArgsSchema = z
  .object({
    selector: z
      .string()
      .optional()
      .describe(
        'CSS selector for targeting elements (required for click_by_selector, click_button)',
      ),
    text: z
      .string()
      .optional()
      .describe(
        'Text content for searching or keyboard input (required for click_by_text, send_keyboard_shortcut)',
      ),
    value: z
      .string()
      .optional()
      .describe('Value to input into form fields (required for fill_input)'),
    placeholder: z
      .string()
      .optional()
      .describe(
        'Placeholder text to identify input fields (alternative to selector for fill_input)',
      ),
    message: z.string().optional().describe('Message or content for specific commands'),
    code: z.string().optional().describe('JavaScript code to execute (for eval command)'),
  })
  .describe('Command-specific arguments. Structure depends on the command being executed.');

// Schema definitions for tool inputs
export const SendCommandToElectronSchema = z.object({
  command: z.string().describe('Command to send to the Electron process'),
  args: CommandArgsSchema.optional().describe(
    'Arguments for the command - must be an object with appropriate properties based on the command type',
  ),
  targetId: z
    .string()
    .optional()
    .describe('CDP target ID to send the command to a specific window (exact match)'),
  windowTitle: z
    .string()
    .optional()
    .describe(
      'Window title to target (case-insensitive partial match). Use list_electron_windows to see available windows.',
    ),
  projectName: z
    .string()
    .optional()
    .describe(
      'Project name to scope this command to. When set, only scans the port assigned to this project.',
    ),
});

export const TakeScreenshotSchema = z.object({
  outputPath: z
    .string()
    .optional()
    .describe('Path to save the screenshot (optional, defaults to temp directory)'),
  targetId: z
    .string()
    .optional()
    .describe('CDP target ID to screenshot a specific window (exact match, takes priority over windowTitle)'),
  windowTitle: z
    .string()
    .optional()
    .describe('Window title to screenshot (case-insensitive partial match). Use list_electron_windows to see available windows.'),
  projectName: z
    .string()
    .optional()
    .describe(
      'Project name to scope this screenshot to. When set, only scans the port assigned to this project.',
    ),
});

export const ReadElectronLogsSchema = z.object({
  logType: z
    .enum(['console', 'main', 'renderer', 'all'])
    .optional()
    .describe('Type of logs to read'),
  lines: z.number().optional().describe('Number of recent lines to read (default: 100)'),
  follow: z.boolean().optional().describe('Whether to follow/tail the logs'),
  projectName: z
    .string()
    .optional()
    .describe(
      'Project name to scope log reading to. When set, only reads logs from the port assigned to this project.',
    ),
});

export const GetElectronWindowInfoSchema = z.object({
  includeChildren: z.boolean().optional().describe('Include child windows information'),
  projectName: z
    .string()
    .optional()
    .describe(
      'Project name to scope window info to. When set, only scans the port assigned to this project.',
    ),
});

export const ListElectronWindowsSchema = z.object({
  includeDevTools: z
    .boolean()
    .optional()
    .describe('Include DevTools windows in the list (default: false)'),
  projectName: z
    .string()
    .optional()
    .describe(
      'Project name to scope the window list to. When set, only lists windows from the port assigned to this project.',
    ),
});

// New project management schemas
export const RegisterProjectSchema = z.object({
  projectName: z.string().describe('Unique project name to register'),
  port: z
    .number()
    .optional()
    .describe('Explicit port number (auto-assigned from range if omitted)'),
  windowTitlePattern: z
    .string()
    .optional()
    .describe('Optional window title pattern to filter targets within the assigned port'),
});

export const UnregisterProjectSchema = z.object({
  projectName: z.string().describe('Project name to unregister'),
});

export const ListProjectsSchema = z.object({});

// Type helper for tool input schema
export type ToolInput = {
  type: 'object';
  properties: Record<string, any>;
  required?: string[];
};
