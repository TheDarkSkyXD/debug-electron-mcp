import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  SendCommandToElectronSchema,
  TakeScreenshotSchema,
  ReadElectronLogsSchema,
  GetElectronWindowInfoSchema,
  ListElectronWindowsSchema,
  ToolInput,
} from './schemas';

// Tool name enumeration
export enum ToolName {
  SEND_COMMAND_TO_ELECTRON = 'send_command_to_electron',
  TAKE_SCREENSHOT = 'take_screenshot',
  READ_ELECTRON_LOGS = 'read_electron_logs',
  GET_ELECTRON_WINDOW_INFO = 'get_electron_window_info',
  LIST_ELECTRON_WINDOWS = 'list_electron_windows',
}

// Helper function to convert Zod schemas to JSON Schema with proper typing
// Using 'as any' to work around deep type instantiation issues with zod-to-json-schema
const toJsonSchema = (schema: any): ToolInput => zodToJsonSchema(schema) as ToolInput;

// Define tools available to the MCP server
export const tools = [
  {
    name: ToolName.GET_ELECTRON_WINDOW_INFO,
    description:
      'Get information about running Electron applications and their windows. Automatically detects any Electron app with remote debugging enabled (port 9222).',
    inputSchema: toJsonSchema(GetElectronWindowInfoSchema),
  },
  {
    name: ToolName.TAKE_SCREENSHOT,
    description:
      `Take a screenshot of any running Electron application window. Returns base64 image data for AI analysis. No files created unless outputPath is specified.

Multi-window support:
- targetId: Specify a CDP target ID to screenshot a specific window (exact match, takes priority)
- windowTitle: Specify a window title to target (case-insensitive partial match)
- If neither is specified, screenshots the first available main window (backward compatible)
- Use 'list_electron_windows' to see available windows and their IDs`,
    inputSchema: toJsonSchema(TakeScreenshotSchema),
  },
  {
    name: ToolName.SEND_COMMAND_TO_ELECTRON,
    description: `Send JavaScript commands to any running Electron application via Chrome DevTools Protocol. 

Enhanced UI interaction commands:
- 'find_elements': Analyze all interactive elements (buttons, inputs, selects) with their properties
- 'click_by_text': Click elements by their visible text, aria-label, or title
- 'click_by_selector': Securely click elements by CSS selector
- 'fill_input': Fill input fields by selector, placeholder text, or associated label
- 'select_option': Select dropdown options by value or text
- 'send_keyboard_shortcut': Send keyboard shortcuts like 'Ctrl+N', 'Meta+N', 'Enter', 'Escape'
- 'navigate_to_hash': Safely navigate to hash routes (e.g., '#create', '#settings')
- 'get_page_structure': Get organized overview of page elements (buttons, inputs, selects, links)
- 'debug_elements': Get debugging info about buttons and form elements on the page
- 'verify_form_state': Check current form state and validation status
- 'get_title', 'get_url', 'get_body_text': Basic page information
- 'eval': Execute custom JavaScript code with enhanced error reporting

Additional interaction commands:
- 'hover': Hover over an element by selector (triggers mouseenter/mouseover events)
- 'drag': Drag from one element to another {"startSelector": "...", "endSelector": "..."}
- 'wait': Wait for element, text, or duration {"selector": "..."} or {"text": "..."} or {"duration": 1000}
- 'type': Type text character by character {"text": "...", "selector": "..."} (triggers key events)
- 'get_attribute': Get element attribute value {"selector": "...", "attribute": "href"}
- 'is_visible': Check if element is visible {"selector": "..."} returns visibility info
- 'count': Count elements matching selector {"selector": "..."} returns total and visible count

IMPORTANT: Arguments must be passed as an object with the correct properties:

Examples:
- click_by_selector: {"selector": "button.submit-btn"}
- click_by_text: {"text": "Submit"}
- fill_input: {"placeholder": "Enter name", "value": "John Doe"}
- fill_input: {"selector": "#email", "value": "user@example.com"}
- send_keyboard_shortcut: {"text": "Enter"}
- hover: {"selector": ".dropdown-trigger"}
- drag: {"startSelector": ".draggable", "endSelector": ".drop-zone"}
- wait: {"selector": ".loading-spinner", "timeout": 5000}
- type: {"text": "Hello World", "selector": "#input-field"}
- get_attribute: {"selector": "a.link", "attribute": "href"}
- is_visible: {"selector": ".modal"}
- count: {"selector": "li.item"}
- eval: {"code": "document.title"}

Use 'get_page_structure' or 'debug_elements' first to understand available elements, then use specific interaction commands.

Multi-window support:
- targetId: Specify a CDP target ID to send commands to a specific window (exact match)
- windowTitle: Specify a window title to target (case-insensitive partial match)
- If neither is specified, commands are sent to the first available main window (backward compatible)
- Use 'list_electron_windows' to see available windows and their IDs`,
    inputSchema: toJsonSchema(SendCommandToElectronSchema),
  },
  {
    name: ToolName.LIST_ELECTRON_WINDOWS,
    description:
      "List all available Electron window targets across all detected applications. Returns window IDs, titles, URLs, and ports. Use the returned IDs with send_command_to_electron's targetId parameter to target specific windows.",
    inputSchema: toJsonSchema(ListElectronWindowsSchema),
  },
  {
    name: ToolName.READ_ELECTRON_LOGS,
    description:
      'Read console logs and output from running Electron applications. Useful for debugging and monitoring app behavior.',
    inputSchema: toJsonSchema(ReadElectronLogsSchema),
  },
];
