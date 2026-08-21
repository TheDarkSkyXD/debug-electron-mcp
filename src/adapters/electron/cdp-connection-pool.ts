import { CdpConnectionUnavailableError, CdpSession, type CdpEvaluationResult } from './cdp-session';

type PoolEntry =
  | {
      readonly kind: 'connecting';
      readonly connection: Promise<CdpSession>;
    }
  | {
      readonly kind: 'ready';
      readonly session: CdpSession;
      activeEvaluations: number;
      idleTimer: ReturnType<typeof setTimeout> | undefined;
    };

export interface CdpConnectionPoolOptions {
  readonly idleTtlMs?: number;
  readonly maxConnections?: number;
}

export class CdpConnectionPool {
  private readonly entries = new Map<string, PoolEntry>();
  private readonly idleTtlMs: number;
  private readonly maxConnections: number;
  private closed = false;

  constructor({ idleTtlMs = 15_000, maxConnections = 8 }: CdpConnectionPoolOptions = {}) {
    if (!Number.isFinite(idleTtlMs) || idleTtlMs <= 0) {
      throw new Error('CDP idle TTL must be positive.');
    }
    if (!Number.isInteger(maxConnections) || maxConnections <= 0) {
      throw new Error('CDP connection capacity must be a positive integer.');
    }
    this.idleTtlMs = idleTtlMs;
    this.maxConnections = maxConnections;
  }

  async evaluate(url: string, javascriptCode: string): Promise<CdpEvaluationResult | undefined> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const session = await this.getSession(url);
      try {
        return await session.evaluate(javascriptCode);
      } catch (error) {
        if (!(error instanceof CdpConnectionUnavailableError) || attempt > 0) throw error;
        await this.evict(url, session);
      } finally {
        this.release(url, session);
      }
    }
    throw new CdpConnectionUnavailableError('CDP connection could not be refreshed.');
  }

  async invalidate(url: string): Promise<void> {
    const entry = this.entries.get(url);
    if (!entry) return;
    this.entries.delete(url);
    if (entry.kind === 'ready') {
      if (entry.idleTimer) clearTimeout(entry.idleTimer);
      await entry.session.close();
      return;
    }
    try {
      await (await entry.connection).close();
    } catch {
      // A failed connection has no retained resource to close.
    }
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    const entries = [...this.entries.values()];
    this.entries.clear();

    await Promise.all(
      entries.map(async (entry) => {
        if (entry.kind === 'ready') {
          if (entry.idleTimer) clearTimeout(entry.idleTimer);
          await entry.session.close();
          return;
        }
        try {
          await (await entry.connection).close();
        } catch {
          // A failed connection has no retained resource to close.
        }
      }),
    );
  }

  private async getSession(url: string): Promise<CdpSession> {
    if (this.closed) throw new CdpConnectionUnavailableError('CDP connection pool is closed.');

    const existing = this.entries.get(url);
    if (existing?.kind === 'connecting') {
      const session = await existing.connection;
      const ready = this.entries.get(url);
      if (ready?.kind !== 'ready' || ready.session !== session) {
        throw new CdpConnectionUnavailableError('CDP connection was evicted while opening.');
      }
      this.acquire(url, ready);
      return session;
    }
    if (existing?.kind === 'ready' && existing.session.isOpen) {
      this.acquire(url, existing);
      return existing.session;
    }
    if (existing?.kind === 'ready') await this.evict(url, existing.session);

    await this.makeRoom();
    const connection = CdpSession.connect(url, (session) => {
      void this.evict(url, session);
    });
    this.entries.set(url, { kind: 'connecting', connection });

    try {
      const session = await connection;
      const current = this.entries.get(url);
      if (this.closed || current?.kind !== 'connecting' || current.connection !== connection) {
        await session.close();
        throw new CdpConnectionUnavailableError('CDP connection pool closed during connection.');
      }
      this.setReady(url, session, 1);
      return session;
    } catch (error) {
      const current = this.entries.get(url);
      if (current?.kind === 'connecting' && current.connection === connection) {
        this.entries.delete(url);
      }
      throw error;
    }
  }

  private setReady(url: string, session: CdpSession, activeEvaluations: number): void {
    this.entries.set(url, {
      kind: 'ready',
      session,
      activeEvaluations,
      idleTimer: undefined,
    });
  }

  private acquire(url: string, entry: Extract<PoolEntry, { kind: 'ready' }>): void {
    if (entry.idleTimer) clearTimeout(entry.idleTimer);
    entry.idleTimer = undefined;
    entry.activeEvaluations += 1;
    this.entries.delete(url);
    this.entries.set(url, entry);
  }

  private release(url: string, session: CdpSession): void {
    const current = this.entries.get(url);
    if (current?.kind !== 'ready' || current.session !== session) return;
    current.activeEvaluations -= 1;
    if (current.activeEvaluations > 0 || !session.isOpen) return;

    current.idleTimer = setTimeout(() => {
      void this.evict(url, session);
    }, this.idleTtlMs);
    current.idleTimer.unref();
  }

  private async evict(url: string, session: CdpSession): Promise<void> {
    const current = this.entries.get(url);
    if (current?.kind !== 'ready' || current.session !== session) return;
    if (current.idleTimer) clearTimeout(current.idleTimer);
    this.entries.delete(url);
    await session.close();
  }

  private async makeRoom(): Promise<void> {
    while (this.entries.size >= this.maxConnections) {
      const oldestKey = [...this.entries].find(
        ([, entry]) => entry.kind === 'ready' && entry.activeEvaluations === 0,
      )?.[0];
      if (oldestKey === undefined) {
        throw new CdpConnectionUnavailableError('Every pooled CDP connection is active.');
      }
      await this.invalidate(oldestKey);
    }
  }
}
