import type { ElectronAppInfo } from './devtools-types';

export type ElectronProbe = (ports?: readonly number[]) => Promise<readonly ElectronAppInfo[]>;

type CacheEntry =
  | {
      readonly kind: 'loading';
      readonly result: Promise<readonly ElectronAppInfo[]>;
    }
  | {
      readonly kind: 'ready';
      readonly expiresAt: number;
      readonly apps: readonly ElectronAppInfo[];
    };

export interface ElectronDiscoveryCacheOptions {
  readonly probe: ElectronProbe;
  readonly ttlMs?: number;
  readonly maxEntries?: number;
  readonly now?: () => number;
}

function copyApps(apps: readonly ElectronAppInfo[]): ElectronAppInfo[] {
  return apps.map((app) => ({
    port: app.port,
    targets: app.targets.map((target) => ({ ...target })),
  }));
}

function normalizePorts(ports?: readonly number[]): readonly number[] | undefined {
  return ports === undefined ? undefined : [...new Set(ports)].sort((left, right) => left - right);
}

function cacheKey(ports?: readonly number[]): string {
  return ports === undefined ? 'default' : `ports:${ports.join(',')}`;
}

export class ElectronDiscoveryCache {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly probe: ElectronProbe;
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor({
    probe,
    ttlMs = 5_000,
    maxEntries = 16,
    now = Date.now,
  }: ElectronDiscoveryCacheOptions) {
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) throw new Error('Discovery TTL must be positive.');
    if (!Number.isInteger(maxEntries) || maxEntries <= 0) {
      throw new Error('Discovery cache capacity must be a positive integer.');
    }
    this.probe = probe;
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this.now = now;
  }

  async scan(ports?: readonly number[]): Promise<ElectronAppInfo[]> {
    const normalizedPorts = normalizePorts(ports);
    const key = cacheKey(normalizedPorts);
    const existing = this.entries.get(key);

    if (existing?.kind === 'loading') return copyApps(await existing.result);
    if (existing?.kind === 'ready' && existing.expiresAt > this.now()) {
      this.touch(key, existing);
      return copyApps(existing.apps);
    }
    if (existing) this.entries.delete(key);

    this.makeRoom();
    const result = this.probe(normalizedPorts).then(copyApps);
    this.entries.set(key, { kind: 'loading', result });

    try {
      const apps = await result;
      const current = this.entries.get(key);
      if (current?.kind === 'loading' && current.result === result) {
        this.entries.set(key, {
          kind: 'ready',
          expiresAt: this.now() + this.ttlMs,
          apps,
        });
      }
      return copyApps(apps);
    } catch (error) {
      const current = this.entries.get(key);
      if (current?.kind === 'loading' && current.result === result) this.entries.delete(key);
      throw error;
    }
  }

  invalidate(ports?: readonly number[]): void {
    this.entries.delete(cacheKey(normalizePorts(ports)));
  }

  clear(): void {
    this.entries.clear();
  }

  private touch(key: string, entry: CacheEntry): void {
    this.entries.delete(key);
    this.entries.set(key, entry);
  }

  private makeRoom(): void {
    while (this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey === undefined) return;
      this.entries.delete(oldestKey);
    }
  }
}
