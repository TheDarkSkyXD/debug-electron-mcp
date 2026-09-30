import { z } from 'zod';
import { ElectronCommandSchema } from './commands';

const finiteNumber = z.number().finite();
const nonEmptyText = z.string().min(1);

export const ActionTargetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('coordinates'), x: finiteNumber, y: finiteNumber }).strict(),
  z.object({ kind: z.literal('selector'), selector: nonEmptyText }).strict(),
]);

export const MouseButtonSchema = z.enum(['left', 'middle', 'right']);
export const KeyModifierSchema = z.enum(['Alt', 'Control', 'Meta', 'Shift']);

export const ElectronActionSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('snapshot'),
      maxElements: z.number().int().min(1).max(500).optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('click'),
      target: ActionTargetSchema,
      button: MouseButtonSchema.optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('double_click'),
      target: ActionTargetSchema,
      button: MouseButtonSchema.optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('long_press'),
      target: ActionTargetSchema,
      durationMs: z.number().int().min(1).max(10_000).optional(),
    })
    .strict(),
  z.object({ kind: z.literal('hover'), target: ActionTargetSchema }).strict(),
  z
    .object({
      kind: z.literal('scroll'),
      deltaX: finiteNumber.optional(),
      deltaY: finiteNumber,
      target: ActionTargetSchema.optional(),
    })
    .strict(),
  z
    .object({ kind: z.literal('type_text'), text: nonEmptyText, selector: nonEmptyText.optional() })
    .strict(),
  z
    .object({
      kind: z.literal('press_key'),
      key: nonEmptyText,
      modifiers: z.array(KeyModifierSchema).optional(),
    })
    .strict(),
  z.object({ kind: z.literal('open_url'), url: nonEmptyText }).strict(),
  z
    .object({
      kind: z.literal('reload'),
      ignoreCache: z.boolean().optional(),
    })
    .strict(),
  z.object({ kind: z.literal('pause') }).strict(),
  z.object({ kind: z.literal('resume') }).strict(),
  z
    .object({
      kind: z.literal('get_cookies'),
      urls: z.array(nonEmptyText).optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('set_cookie'),
      name: nonEmptyText,
      value: z.string(),
      url: nonEmptyText.optional(),
      domain: nonEmptyText.optional(),
      path: nonEmptyText.optional(),
      secure: z.boolean().optional(),
      httpOnly: z.boolean().optional(),
      sameSite: z.enum(['Strict', 'Lax', 'None']).optional(),
      expires: finiteNumber.optional(),
    })
    .strict()
    .refine((cookie) => Boolean(cookie.url ?? cookie.domain), {
      message: 'Provide cookie url or domain.',
    }),
  z
    .object({
      kind: z.literal('get_storage'),
      store: z.enum(['localStorage', 'sessionStorage']).optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('set_storage'),
      store: z.enum(['localStorage', 'sessionStorage']).optional(),
      entries: z.record(z.string(), z.string()),
      clear: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('command'),
      command: ElectronCommandSchema,
      args: z.record(z.string(), z.unknown()).default({}),
    })
    .strict(),
]);

export const ElectronActionBatchSchema = z.array(ElectronActionSchema).min(1).max(50);

const DEFAULT_TRACE_CATEGORIES = [
  'devtools.timeline',
  'v8.execute',
  'disabled-by-default-devtools.timeline',
  'disabled-by-default-devtools.timeline.frame',
  'disabled-by-default-devtools.timeline.stack',
  'disabled-by-default-v8.cpu_profiler',
  'disabled-by-default-v8.cpu_profiler.hires',
].join(',');

/**
 * Record a Chrome DevTools trace across the whole action batch.
 *
 * Tracing is scoped to one call on purpose. A separate start/stop pair would
 * have to keep a live CDP socket alive between two unrelated HTTP requests,
 * which is exactly the retained session state this server is built to avoid.
 */
export const TraceCaptureSchema = z
  .object({
    /** Where to write the trace JSON. Defaults to a temp file. */
    outputPath: z.string().min(1).optional(),
    categories: z.string().min(1).optional(),
  })
  .strict();

/**
 * Record a V8 CPU profile across the whole action batch.
 *
 * Shares the batch scope and the path guard of {@link TraceCaptureSchema}. A
 * separate start and stop pair would hold a CDP session open between two
 * unrelated requests, so both captures are bounded to one call.
 */
export const ProfileCaptureSchema = z
  .object({
    /** Where to write the profile JSON. Defaults to a temp file. */
    outputPath: z.string().min(1).optional(),
    /** Sampling interval in microseconds. Lower is finer and slower. */
    intervalUs: z.number().int().min(100).max(10_000_000).optional(),
  })
  .strict();

export type ActionTarget = z.infer<typeof ActionTargetSchema>;
export type MouseButton = z.infer<typeof MouseButtonSchema>;
export type KeyModifier = z.infer<typeof KeyModifierSchema>;
export type ElectronAction = z.infer<typeof ElectronActionSchema>;
export type TraceCapture = z.infer<typeof TraceCaptureSchema>;
export type ProfileCapture = z.infer<typeof ProfileCaptureSchema>;

export const DEFAULT_TRACE_CATEGORIES_EXPORT = DEFAULT_TRACE_CATEGORIES;

export type ElectronActionResult =
  | Readonly<{ index: number; kind: ElectronAction['kind']; ok: true; value: unknown }>
  | Readonly<{ index: number; kind: ElectronAction['kind']; ok: false; error: string }>;
