import { z } from 'zod';
import type { CommandArgs } from './utils/electron-enhanced-commands';

type CommandSpec = Readonly<{
  summary: string;
  argsSchema: z.ZodObject<z.ZodRawShape>;
}>;

const emptyArgs = z.object({}).strict();
const selectorArgs = z.object({ selector: z.string().min(1) }).strict();

export const commandSpecs = {
  click_button: { summary: 'Click a button selected by CSS.', argsSchema: selectorArgs },
  click_by_selector: { summary: 'Click an element selected by CSS.', argsSchema: selectorArgs },
  click_by_text: {
    summary: 'Click the best matching visible label.',
    argsSchema: z.object({ text: z.string().min(1) }).strict(),
  },
  console_log: {
    summary: 'Write a message to the renderer console.',
    argsSchema: z.object({ message: z.string().min(1).optional() }).strict(),
  },
  count: { summary: 'Count elements selected by CSS.', argsSchema: selectorArgs },
  debug_elements: { summary: 'Inspect visible buttons and inputs.', argsSchema: emptyArgs },
  drag: {
    summary: 'Drag from one CSS selector to another.',
    argsSchema: z
      .object({ startSelector: z.string().min(1), endSelector: z.string().min(1) })
      .strict(),
  },
  eval: {
    summary: 'Evaluate JavaScript in the selected renderer.',
    argsSchema: z.object({ code: z.string().min(1) }).strict(),
  },
  fill_input: {
    summary: 'Set a form value by selector or placeholder.',
    argsSchema: z
      .object({
        selector: z.string().min(1).optional(),
        placeholder: z.string().min(1).optional(),
        text: z.string().min(1).optional(),
        value: z.string().min(1),
      })
      .strict(),
  },
  find_elements: { summary: 'Inspect interactive page elements.', argsSchema: emptyArgs },
  get_attribute: {
    summary: 'Read an attribute from one element.',
    argsSchema: z.object({ selector: z.string().min(1), attribute: z.string().min(1) }).strict(),
  },
  get_body_text: { summary: 'Read the visible body text.', argsSchema: emptyArgs },
  get_page_structure: { summary: 'Inspect the page structure.', argsSchema: emptyArgs },
  get_title: { summary: 'Read the document title.', argsSchema: emptyArgs },
  get_url: { summary: 'Read the current URL.', argsSchema: emptyArgs },
  hover: { summary: 'Hover an element selected by CSS.', argsSchema: selectorArgs },
  is_visible: { summary: 'Check whether an element is visible.', argsSchema: selectorArgs },
  navigate_to_hash: {
    summary: 'Navigate to a hash route.',
    argsSchema: z.object({ text: z.string().min(1) }).strict(),
  },
  select_option: {
    summary: 'Select an option by value or label.',
    argsSchema: z
      .object({
        selector: z.string().min(1).optional(),
        text: z.string().min(1).optional(),
        value: z.string().min(1),
      })
      .strict(),
  },
  send_keyboard_shortcut: {
    summary: 'Send a keyboard shortcut.',
    argsSchema: z.object({ text: z.string().min(1) }).strict(),
  },
  type: {
    summary: 'Type text into a selected or focused input.',
    argsSchema: z
      .object({
        selector: z.string().min(1).optional(),
        text: z.string().min(1),
        slowly: z.boolean().optional(),
      })
      .strict(),
  },
  verify_form_state: { summary: 'Inspect form validity and values.', argsSchema: emptyArgs },
  wait: {
    summary: 'Wait for a selector, text, or duration.',
    argsSchema: z
      .object({
        selector: z.string().min(1).optional(),
        text: z.string().min(1).optional(),
        duration: z.number().int().positive().max(30_000).optional(),
        timeout: z.number().int().positive().max(30_000).optional(),
      })
      .strict(),
  },
} as const satisfies Record<string, CommandSpec>;

export const ElectronCommandSchema = z.enum([
  'click_button',
  'click_by_selector',
  'click_by_text',
  'console_log',
  'count',
  'debug_elements',
  'drag',
  'eval',
  'fill_input',
  'find_elements',
  'get_attribute',
  'get_body_text',
  'get_page_structure',
  'get_title',
  'get_url',
  'hover',
  'is_visible',
  'navigate_to_hash',
  'select_option',
  'send_keyboard_shortcut',
  'type',
  'verify_form_state',
  'wait',
]);

export type ElectronCommand = z.infer<typeof ElectronCommandSchema>;

export function parseElectronCommand(command: ElectronCommand, args: unknown): CommandArgs {
  return commandSpecs[command].argsSchema.parse(args);
}

export function describeElectronCommand(command: ElectronCommand): Readonly<{
  command: ElectronCommand;
  summary: string;
  inputSchema: Record<string, unknown>;
}> {
  const spec = commandSpecs[command];
  return { command, summary: spec.summary, inputSchema: z.toJSONSchema(spec.argsSchema) };
}
