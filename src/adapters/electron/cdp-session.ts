import WebSocket from 'ws';

export interface CdpEvaluationResult {
  readonly type: string;
  readonly value?: unknown;
  readonly description?: string;
  readonly className?: string;
  readonly objectId?: string;
}

interface PendingEvaluation {
  readonly resolve: (result: CdpEvaluationResult | undefined) => void;
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
  private readonly pending = new Map<number, PendingEvaluation>();
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

  evaluate(javascriptCode: string, timeoutMs = 10_000): Promise<CdpEvaluationResult | undefined> {
    if (!this.isOpen) {
      throw new CdpConnectionUnavailableError('CDP connection is not open.');
    }

    const messageId = this.nextMessageId;
    this.nextMessageId += 1;

    return new Promise<CdpEvaluationResult | undefined>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(messageId);
        reject(new Error(`Command execution timeout (${timeoutMs}ms)`));
      }, timeoutMs);
      timeout.unref();
      this.pending.set(messageId, { resolve, reject, timeout });

      this.socket.send(
        JSON.stringify({
          id: messageId,
          method: 'Runtime.evaluate',
          params: {
            expression: javascriptCode,
            returnByValue: true,
            awaitPromise: true,
          },
        }),
        (error) => {
          if (!error) return;
          const pending = this.pending.get(messageId);
          if (!pending) return;
          clearTimeout(pending.timeout);
          this.pending.delete(messageId);
          pending.reject(
            new Error(`Failed to send CDP command: ${error.message}`, { cause: error }),
          );
        },
      );
    });
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
      if (!isRecord(response) || typeof response.id !== 'number') return;
      const pending = this.pending.get(response.id);
      if (!pending) return;

      clearTimeout(pending.timeout);
      this.pending.delete(response.id);

      if (isRecord(response.error)) {
        const message =
          typeof response.error.message === 'string'
            ? response.error.message
            : 'Unknown protocol error';
        pending.reject(new Error(`DevTools Protocol error: ${message}`));
        return;
      }

      if (!isRecord(response.result) || !('result' in response.result)) {
        pending.resolve(undefined);
        return;
      }

      const result = response.result.result;
      if (!isEvaluationResult(result)) {
        pending.reject(new Error('DevTools Protocol returned a malformed evaluation result.'));
        return;
      }
      pending.resolve(result);
    } catch (error) {
      this.rejectPending(
        new Error(
          `Failed to parse CDP response: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  }

  private rejectPending(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pending.clear();
  }
}
