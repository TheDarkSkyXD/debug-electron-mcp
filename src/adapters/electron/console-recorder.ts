import type { CdpClient } from './cdp-connection-pool';

/**
 * How many messages each recorder keeps.
 *
 * A chatty renderer produces far more than an agent will read, so this is a
 * ring. The bound is per target, and a target that is never inspected holds no
 * recorder at all.
 */
const DEFAULT_CAPACITY = 200;

export interface ConsoleEntry {
  readonly at: string;
  readonly level: string;
  readonly text: string;
  readonly source: 'console' | 'log' | 'exception';
  readonly url?: string;
  readonly line?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function readString(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  return typeof value === 'string' ? value : undefined;
}

function readNumber(source: Record<string, unknown>, key: string): number | undefined {
  const value = source[key];
  return typeof value === 'number' ? value : undefined;
}

/**
 * Flattens a `Runtime.consoleAPICalled` argument list into readable text.
 *
 * A single object argument is stringified rather than shown as `[object Object]`,
 * because the common renderer failure is `console.error('failed', response)`
 * and the response body is the part worth reading.
 */
function describeArguments(args: readonly unknown[]): string {
  return args
    .map((argument) => {
      if (!isRecord(argument)) return String(argument);
      const value = argument.value;
      if (value !== undefined) {
        return typeof value === 'object' ? safeStringify(value) : String(value);
      }
      return readString(argument, 'description') ?? readString(argument, 'type') ?? '';
    })
    .join(' ');
}

function safeStringify(value: unknown): string {
  if (value === null) return 'null';
  try {
    return JSON.stringify(value)?.slice(0, 2_000) ?? String(value);
  } catch {
    // Circular structures are common in error payloads.
    return '[unserializable]';
  }
}

function firstFrameLocation(details: Record<string, unknown>): { url?: string; line?: number } {
  const stack = details.stackTrace;
  if (!isRecord(stack) || !Array.isArray(stack.callFrames)) return {};
  const frame = stack.callFrames.find(isRecord);
  if (!frame) return {};
  const url = readString(frame, 'url');
  const line = readNumber(frame, 'lineNumber');
  return {
    ...(url === undefined ? {} : { url }),
    // CDP reports 0-based lines; callers expect 1-based.
    ...(line === undefined ? {} : { line: line + 1 }),
  };
}

/**
 * Records console, log, and exception events for the life of one pooled session.
 *
 * A push-based MCP notification channel would be the ideal transport, but the
 * 2026 protocol's server event union carries only catalog-change events, so
 * there is nothing to push through. This is therefore a bounded buffer the
 * caller polls, which also means no message outlives the session that produced
 * it.
 */
export class ConsoleRecorder {
  private readonly entries: ConsoleEntry[] = [];
  private readonly unsubscribe: Array<() => void> = [];
  private stopped = false;

  constructor(
    private readonly client: CdpClient,
    private readonly capacity: number = DEFAULT_CAPACITY,
  ) {
    this.attach('Runtime.consoleAPICalled', (params) => this.onConsole(params));
    this.attach('Log.entryAdded', (params) => this.onLogEntry(params));
    this.attach('Runtime.exceptionThrown', (params) => this.onException(params));
  }

  /**
   * Enable the domains. Failures are swallowed so a target that refuses them
   * stays usable for every other operation.
   */
  async enable(): Promise<void> {
    for (const domain of ['Runtime.enable', 'Log.enable']) {
      try {
        await this.client.request(domain);
      } catch {
        // The buffer simply stays sparse for this target.
      }
    }
  }

  /** Release every protocol listener. Safe to call more than once. */
  dispose(): void {
    if (this.stopped) return;
    this.stopped = true;
    for (const off of this.unsubscribe.splice(0)) off();
  }

  /**
   * Snapshot, oldest first. `level` filters to an exact level, `errorsOnly`
   * keeps errors, asserts, and thrown exceptions.
   */
  read(limit?: number, level?: string, errorsOnly = false): ConsoleEntry[] {
    const wanted = level?.toLowerCase();
    let filtered = this.entries;
    if (errorsOnly) {
      filtered = filtered.filter(
        (entry) =>
          entry.level === 'error' || entry.level === 'assert' || entry.source === 'exception',
      );
    } else if (wanted) {
      filtered = filtered.filter((entry) => entry.level.toLowerCase() === wanted);
    }
    return limit && limit > 0 ? filtered.slice(-limit) : [...filtered];
  }

  count(errorsOnly = false): number {
    return this.read(undefined, undefined, errorsOnly).length;
  }

  private attach(method: string, handler: (params: Record<string, unknown>) => void): void {
    this.unsubscribe.push(
      this.client.on(method, (params) => {
        if (!this.stopped && isRecord(params)) handler(params);
      }),
    );
  }

  private push(entry: ConsoleEntry): void {
    this.entries.push(entry);
    const excess = this.entries.length - this.capacity;
    if (excess > 0) this.entries.splice(0, excess);
  }

  private onConsole(params: Record<string, unknown>): void {
    const args = Array.isArray(params.args) ? params.args : [];
    this.push({
      at: new Date().toISOString(),
      level: readString(params, 'type') ?? 'log',
      text: describeArguments(args).slice(0, 4_000),
      source: 'console',
    });
  }

  private onLogEntry(params: Record<string, unknown>): void {
    const entry = isRecord(params.entry) ? params.entry : {};
    this.push({
      at: new Date().toISOString(),
      level: readString(entry, 'level') ?? 'log',
      text: (readString(entry, 'text') ?? '').slice(0, 4_000),
      source: 'log',
      ...(readString(entry, 'url') === undefined
        ? {}
        : { url: readString(entry, 'url'), line: readNumber(entry, 'lineNumber') }),
    });
  }

  private onException(params: Record<string, unknown>): void {
    const details = isRecord(params.exceptionDetails) ? params.exceptionDetails : {};
    const exception = isRecord(details.exception) ? details.exception : {};
    // The description carries the stack; the text is usually just "Uncaught".
    const text =
      readString(exception, 'description') ?? readString(details, 'text') ?? 'Uncaught exception';
    this.push({
      at: new Date().toISOString(),
      level: 'error',
      text: text.slice(0, 4_000),
      source: 'exception',
      ...firstFrameLocation(details),
    });
  }
}
