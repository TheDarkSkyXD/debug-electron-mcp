import WebSocket from 'ws';

export interface CdpEvaluationResult {
  readonly type: string;
  readonly value?: unknown;
  readonly description?: string;
  readonly className?: string;
  readonly objectId?: string;
}

interface PendingRequest {
  readonly method: string;
  readonly resolve: (result: unknown) => void;
  readonly reject: (error: Error) => void;
  readonly timeout: ReturnType<typeof setTimeout>;
}

export class CdpConnectionOpenError extends Error {
  override readonly name = 'CdpConnectionOpenError';
}

export class CdpConnectionUnavailableError extends Error {
  override readonly name = 'CdpConnectionUnavailableError';
}

export interface CdpConnectionAttempt {
  readonly session: Promise<CdpSession>;
  readonly cancel: () => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function isEvaluationResult(value: unknown): value is CdpEvaluationResult {
  return (
    isRecord(value) &&
    typeof value.type === 'string' &&
    (!('description' in value) || typeof value.description === 'string') &&
    (!('className' in value) || typeof value.className === 'string') &&
    (!('objectId' in value) || typeof value.objectId === 'string')
  );
}

export class CdpSession {
  private readonly pending = new Map<number, PendingRequest>();
  private readonly eventListeners = new Map<string, Set<(params: unknown) => void>>();
  private healthy = true;
  private nextMessageId = 2;

  private constructor(
    private readonly socket: WebSocket,
    private readonly onClose: (session: CdpSession) => void,
  ) {
    socket.on('message', (data) => this.handleMessage(data.toString()));
    socket.on('error', (error) => {
      this.healthy = false;
      this.rejectPending(new Error(`WebSocket error: ${error.message}`, { cause: error }));
    });
    socket.on('close', () => {
      this.healthy = false;
      this.rejectPending(new Error('CDP connection closed before evaluation completed.'));
      this.onClose(this);
    });
    socket.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
  }

  static connect(
    url: string,
    onClose: (session: CdpSession) => void = () => undefined,
    timeoutMs = 10_000,
  ): Promise<CdpSession> {
    return CdpSession.beginConnect(url, onClose, timeoutMs).session;
  }

  static beginConnect(
    url: string,
    onClose: (session: CdpSession) => void = () => undefined,
    timeoutMs = 10_000,
  ): CdpConnectionAttempt {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new Error('CDP connection timeout must be positive.');
    }

    let cancel: () => void = () => undefined;
    const session = new Promise<CdpSession>((resolve, reject) => {
      const socket = new WebSocket(url);
      let settled = false;
      const timeout = setTimeout(() => {
        fail(`CDP connection timed out after ${timeoutMs}ms.`);
      }, timeoutMs);
      timeout.unref();
      const cleanup = () => {
        clearTimeout(timeout);
        socket.off('error', handleError);
        socket.off('close', handleClose);
      };
      const fail = (message: string, cause?: unknown) => {
        if (settled) return;
        settled = true;
        cleanup();
        socket.on('error', () => undefined);
        if (socket.readyState !== WebSocket.CLOSED) socket.terminate();
        reject(new CdpConnectionOpenError(message, { cause }));
      };
      const handleError = (error: Error) =>
        fail(`Failed to open CDP connection: ${error.message}`, error);
      const handleClose = () => fail('CDP connection closed before it opened.');
      cancel = () => fail('CDP connection opening was cancelled.');

      socket.once('error', handleError);
      socket.once('close', handleClose);
      socket.once('open', () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(new CdpSession(socket, onClose));
      });
    });
    return { session, cancel: () => cancel() };
  }

  get isOpen(): boolean {
    return this.healthy && this.socket.readyState === WebSocket.OPEN;
  }

  /**
   * Subscribe to a protocol event such as `Tracing.dataCollected`.
   *
   * Events arrive on the same socket as responses but carry no message id, so
   * they would otherwise be discarded. Returns an unsubscribe function, since
   * pooled sessions outlive a single operation and a listener that outlives its
   * subscription keeps a completed trace's data alive.
   */
  on(method: string, listener: (params: unknown) => void): () => void {
    const existing = this.eventListeners.get(method);
    if (existing) {
      existing.add(listener);
    } else {
      this.eventListeners.set(method, new Set([listener]));
    }
    return () => {
      this.eventListeners.get(method)?.delete(listener);
    };
  }

  request(
    method: string,
    params: Record<string, unknown> = {},
    timeoutMs = 10_000,
  ): Promise<unknown> {
    if (!this.isOpen) {
      throw new CdpConnectionUnavailableError('CDP connection is not open.');
    }

    const messageId = this.nextMessageId;
    this.nextMessageId += 1;

    return new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(messageId);
        reject(new Error(`CDP request ${method} timed out after ${timeoutMs}ms.`));
      }, timeoutMs);
      timeout.unref();
      this.pending.set(messageId, { method, resolve, reject, timeout });

      this.socket.send(
        JSON.stringify({
          id: messageId,
          method,
          params,
        }),
        (error) => {
          if (!error) return;
          const pending = this.pending.get(messageId);
          if (!pending) return;
          clearTimeout(pending.timeout);
          this.pending.delete(messageId);
          pending.reject(
            new Error(`Failed to send CDP request ${method}: ${error.message}`, { cause: error }),
          );
        },
      );
    });
  }

  async evaluate(
    javascriptCode: string,
    timeoutMs = 10_000,
  ): Promise<CdpEvaluationResult | undefined> {
    const response = await this.request(
      'Runtime.evaluate',
      {
        expression: javascriptCode,
        returnByValue: true,
        awaitPromise: true,
      },
      timeoutMs,
    );
    if (!isRecord(response) || !('result' in response)) {
      throw new Error('DevTools Protocol returned a malformed evaluation response.');
    }
    if (response.result === undefined) return undefined;
    if (!isEvaluationResult(response.result)) {
      throw new Error('DevTools Protocol returned a malformed evaluation result.');
    }
    return response.result;
  }

  async close(): Promise<void> {
    if (this.socket.readyState === WebSocket.CLOSED) return;

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        this.socket.terminate();
        resolve();
      }, 100);
      timeout.unref();
      this.socket.once('close', () => {
        clearTimeout(timeout);
        resolve();
      });
      if (this.socket.readyState === WebSocket.OPEN) this.socket.close();
    });
  }

  private handleMessage(rawMessage: string): void {
    try {
      const response: unknown = JSON.parse(rawMessage);
      if (!isRecord(response)) return;

      if (typeof response.id !== 'number') {
        if (typeof response.method === 'string') {
          this.dispatchEvent(response.method, response.params);
        }
        return;
      }

      const pending = this.pending.get(response.id);
      if (!pending) return;

      clearTimeout(pending.timeout);
      this.pending.delete(response.id);

      if (isRecord(response.error)) {
        const message =
          typeof response.error.message === 'string'
            ? response.error.message
            : 'Unknown protocol error';
        pending.reject(new Error(`DevTools Protocol error for ${pending.method}: ${message}`));
        return;
      }

      pending.resolve(response.result);
    } catch (error) {
      this.healthy = false;
      this.rejectPending(
        new Error(
          `Failed to parse CDP response: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
      if (this.socket.readyState !== WebSocket.CLOSED) this.socket.terminate();
    }
  }

  private dispatchEvent(method: string, params: unknown): void {
    const listeners = this.eventListeners.get(method);
    if (!listeners) return;
    for (const listener of listeners) {
      try {
        listener(params);
      } catch (error) {
        // One faulty listener must not stop the others or kill the session.
        this.healthy = false;
        this.rejectPending(
          new Error(`CDP event listener for ${method} threw: ${String(error)}`, { cause: error }),
        );
      }
    }
  }

  private rejectPending(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(
        new Error(`CDP request ${pending.method} failed: ${error.message}`, { cause: error }),
      );
    }
    this.pending.clear();
  }
}
