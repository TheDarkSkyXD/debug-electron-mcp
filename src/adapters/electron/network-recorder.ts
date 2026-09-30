import type { CdpClient } from './cdp-connection-pool';

/**
 * How many entries each recorder keeps.
 *
 * Network events arrive far faster than an agent can read them, so this is a
 * ring, not a log. The bound is per target, and a target that is never
 * inspected holds no recorder at all.
 */
const DEFAULT_CAPACITY = 200;

export interface NetworkEntry {
  readonly at: string;
  readonly event: 'request' | 'response' | 'failed' | 'finished';
  readonly requestId: string;
  readonly url?: string;
  readonly method?: string;
  readonly status?: number;
  readonly mimeType?: string;
  readonly resourceType?: string;
  readonly errorText?: string;
  readonly durationMs?: number;
}

/** A short summary of one entry, for listings where the body is not wanted. */
export type NetworkEntrySummary = Omit<NetworkEntry, 'resourceType' | 'errorText' | 'durationMs'>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function readString(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  return typeof value === 'string' ? value : undefined;
}

/**
 * Records Chrome DevTools Network events for the life of one pooled session.
 *
 * The recorder is request-scoped on purpose. A persistent buffer would be
 * session state, which the stateless protocol has no place for, and would keep
 * request URLs — which routinely carry tokens — alive after the response.
 */
export class NetworkRecorder {
  private readonly entries: NetworkEntry[] = [];
  private readonly requestStarted = new Map<string, number>();
  private readonly unsubscribe: Array<() => void> = [];
  private stopped = false;

  constructor(
    private readonly client: CdpClient,
    private readonly capacity: number = DEFAULT_CAPACITY,
  ) {
    this.attach('Network.requestWillBeSent', (params) => this.onRequest(params));
    this.attach('Network.responseReceived', (params) => this.onResponse(params));
    this.attach('Network.loadingFinished', (params) => this.onFinished(params));
    this.attach('Network.loadingFailed', (params) => this.onFailed(params));
  }

  /**
   * Enable the domain. Failures are swallowed: a target that refuses Network
   * is still usable for everything else, so this must not fail the operation
   * that happens to be in flight.
   */
  async enable(): Promise<void> {
    try {
      await this.client.request('Network.enable');
    } catch {
      // The buffer simply stays empty for this target.
    }
  }

  /** Release every protocol listener. Safe to call more than once. */
  dispose(): void {
    if (this.stopped) return;
    this.stopped = true;
    for (const off of this.unsubscribe.splice(0)) off();
    this.requestStarted.clear();
  }

  /** Snapshot, newest last, optionally filtered to failed responses. */
  read(limit?: number, failuresOnly = false): NetworkEntry[] {
    const filtered = failuresOnly ? this.entries.filter(isFailure) : this.entries;
    return limit && limit > 0 ? filtered.slice(-limit) : [...filtered];
  }

  count(failuresOnly = false): number {
    return failuresOnly ? this.entries.filter(isFailure).length : this.entries.length;
  }

  private attach(method: string, handler: (params: Record<string, unknown>) => void): void {
    this.unsubscribe.push(
      this.client.on(method, (params) => {
        if (!this.stopped && isRecord(params)) handler(params);
      }),
    );
  }

  private push(entry: NetworkEntry): void {
    this.entries.push(entry);
    // Drop the oldest once over the bound, so a burst cannot grow the array
    // without limit while a slow reader is holding the session open.
    const excess = this.entries.length - this.capacity;
    if (excess > 0) this.entries.splice(0, excess);
  }

  private onRequest(params: Record<string, unknown>): void {
    const requestId = readString(params, 'requestId');
    if (!requestId) return;
    this.requestStarted.set(requestId, Date.now());
    const request = isRecord(params.request) ? params.request : {};
    this.push({
      at: new Date().toISOString(),
      event: 'request',
      requestId,
      url: readString(request, 'url'),
      method: readString(request, 'method'),
      resourceType: readString(params, 'type'),
    });
  }

  private onResponse(params: Record<string, unknown>): void {
    const requestId = readString(params, 'requestId');
    if (!requestId) return;
    const response = isRecord(params.response) ? params.response : {};
    const startedAt = this.requestStarted.get(requestId);
    this.push({
      at: new Date().toISOString(),
      event: 'response',
      requestId,
      url: readString(response, 'url'),
      status: typeof response.status === 'number' ? response.status : undefined,
      mimeType: readString(response, 'mimeType'),
      resourceType: readString(params, 'type'),
      ...(startedAt === undefined ? {} : { durationMs: Date.now() - startedAt }),
    });
  }

  private onFinished(params: Record<string, unknown>): void {
    const requestId = readString(params, 'requestId');
    if (!requestId) return;
    const startedAt = this.requestStarted.get(requestId);
    this.requestStarted.delete(requestId);
    this.push({
      at: new Date().toISOString(),
      event: 'finished',
      requestId,
      ...(startedAt === undefined ? {} : { durationMs: Date.now() - startedAt }),
    });
  }

  private onFailed(params: Record<string, unknown>): void {
    const requestId = readString(params, 'requestId');
    if (!requestId) return;
    const startedAt = this.requestStarted.get(requestId);
    this.requestStarted.delete(requestId);
    this.push({
      at: new Date().toISOString(),
      event: 'failed',
      requestId,
      errorText: readString(params, 'errorText'),
      resourceType: readString(params, 'type'),
      ...(startedAt === undefined ? {} : { durationMs: Date.now() - startedAt }),
    });
  }
}

function isFailure(entry: NetworkEntry): boolean {
  // A transport-level failure, or an HTTP status that is not 2xx/3xx.
  if (entry.event === 'failed') return true;
  return entry.event === 'response' && entry.status !== undefined && entry.status >= 400;
}
