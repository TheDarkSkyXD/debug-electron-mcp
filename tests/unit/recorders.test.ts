import { describe, expect, it, vi } from 'vitest';
import type { CdpClient } from '../../src/adapters/electron/cdp-connection-pool';
import { ConsoleRecorder } from '../../src/adapters/electron/console-recorder';
import { NetworkRecorder } from '../../src/adapters/electron/network-recorder';

/** A client whose events are driven by the test rather than a real socket. */
function createClient(responses: Record<string, unknown> = {}) {
  const listeners = new Map<string, Set<(params: unknown) => void>>();
  const requested: string[] = [];
  const client: CdpClient = {
    evaluate: async () => undefined,
    request: async (method) => {
      requested.push(method);
      return responses[method] ?? {};
    },
    on: (method, listener) => {
      const existing = listeners.get(method) ?? new Set();
      existing.add(listener);
      listeners.set(method, existing);
      return () => existing.delete(listener);
    },
  };
  return {
    client,
    requested,
    emit: (method: string, params: unknown) => {
      for (const listener of listeners.get(method) ?? []) listener(params);
    },
    listenerCount: (method: string) => listeners.get(method)?.size ?? 0,
  };
}

describe('NetworkRecorder', () => {
  it('records a request, its response, and the elapsed time', async () => {
    const harness = createClient();
    const recorder = new NetworkRecorder(harness.client);
    await recorder.enable();

    harness.emit('Network.requestWillBeSent', {
      requestId: '1',
      request: { url: 'https://api.test/items', method: 'GET' },
      type: 'XHR',
    });
    harness.emit('Network.responseReceived', {
      requestId: '1',
      response: { url: 'https://api.test/items', status: 200, mimeType: 'application/json' },
    });

    const entries = recorder.read();
    expect(entries.map((entry) => entry.event)).toEqual(['request', 'response']);
    expect(entries[1]?.status).toBe(200);
    expect(entries[1]?.durationMs).toBeGreaterThanOrEqual(0);
    expect(harness.requested).toContain('Network.enable');
  });

  it('treats a 4xx response as a failure and a 2xx as not', () => {
    const harness = createClient();
    const recorder = new NetworkRecorder(harness.client);

    harness.emit('Network.responseReceived', {
      requestId: '1',
      response: { url: 'https://api.test/a', status: 404 },
    });
    harness.emit('Network.responseReceived', {
      requestId: '2',
      response: { url: 'https://api.test/b', status: 204 },
    });

    expect(recorder.read(undefined, true).map((entry) => entry.requestId)).toEqual(['1']);
  });

  it('records a transport failure with its error text', () => {
    const harness = createClient();
    const recorder = new NetworkRecorder(harness.client);

    harness.emit('Network.loadingFailed', {
      requestId: '1',
      errorText: 'net::ERR_CONNECTION_REFUSED',
    });

    const failures = recorder.read(undefined, true);
    expect(failures).toHaveLength(1);
    expect(failures[0]?.errorText).toBe('net::ERR_CONNECTION_REFUSED');
  });

  it('returns the newest entries when a limit is given', () => {
    const harness = createClient();
    const recorder = new NetworkRecorder(harness.client);

    for (let index = 0; index < 5; index += 1) {
      harness.emit('Network.requestWillBeSent', {
        requestId: String(index),
        request: { url: `https://api.test/${index}` },
      });
    }

    expect(recorder.read(2).map((entry) => entry.requestId)).toEqual(['3', '4']);
  });

  it('stops recording past its bound instead of growing without limit', () => {
    const harness = createClient();
    const recorder = new NetworkRecorder(harness.client, 10);

    for (let index = 0; index < 50; index += 1) {
      harness.emit('Network.requestWillBeSent', {
        requestId: String(index),
        request: { url: `https://api.test/${index}` },
      });
    }

    const entries = recorder.read();
    expect(entries).toHaveLength(10);
    // The oldest were dropped, so the newest survive.
    expect(entries.at(-1)?.requestId).toBe('49');
  });

  it('releases its listeners on dispose and ignores later events', () => {
    const harness = createClient();
    const recorder = new NetworkRecorder(harness.client);
    recorder.dispose();
    recorder.dispose();

    expect(harness.listenerCount('Network.requestWillBeSent')).toBe(0);
    harness.emit('Network.requestWillBeSent', { requestId: '1', request: {} });
    expect(recorder.read()).toEqual([]);
  });

  it('stays usable when the target refuses the Network domain', async () => {
    const failing = createClient();
    vi.spyOn(failing.client, 'request').mockRejectedValue(new Error('Network.enable failed'));
    const recorder = new NetworkRecorder(failing.client);

    await expect(recorder.enable()).resolves.toBeUndefined();
  });
});

describe('ConsoleRecorder', () => {
  it('flattens console arguments into readable text', () => {
    const harness = createClient();
    const recorder = new ConsoleRecorder(harness.client);

    harness.emit('Runtime.consoleAPICalled', {
      type: 'warning',
      args: [{ type: 'string', value: 'slow response' }, { type: 'number', value: 842 }],
    });

    const entries = recorder.read();
    expect(entries[0]?.level).toBe('warning');
    expect(entries[0]?.text).toBe('slow response 842');
  });

  it('stringifies an object argument instead of printing [object Object]', () => {
    const harness = createClient();
    const recorder = new ConsoleRecorder(harness.client);

    harness.emit('Runtime.consoleAPICalled', {
      type: 'error',
      args: [{ type: 'object', value: { status: 500, body: 'boom' } }],
    });

    expect(recorder.read()[0]?.text).toBe('{"status":500,"body":"boom"}');
  });

  it('survives a circular object argument', () => {
    const harness = createClient();
    const recorder = new ConsoleRecorder(harness.client);
    const circular: Record<string, unknown> = { name: 'loop' };
    circular.self = circular;

    harness.emit('Runtime.consoleAPICalled', { type: 'error', args: [{ value: circular }] });

    expect(recorder.read()[0]?.text).toBe('[unserializable]');
  });

  it('keeps the stack of a thrown exception and its first frame', () => {
    const harness = createClient();
    const recorder = new ConsoleRecorder(harness.client);

    harness.emit('Runtime.exceptionThrown', {
      exceptionDetails: {
        text: 'Uncaught',
        exception: { description: 'TypeError: x is not a function\n    at app.js:4' },
        stackTrace: { callFrames: [{ url: 'app.js', lineNumber: 3 }] },
      },
    });

    const entry = recorder.read()[0];
    expect(entry?.source).toBe('exception');
    expect(entry?.level).toBe('error');
    expect(entry?.text).toContain('TypeError');
    // CDP lines are 0-based; the caller is told 4.
    expect(entry?.line).toBe(4);
    expect(entry?.url).toBe('app.js');
  });

  it('filters to errors and exceptions when asked', () => {
    const harness = createClient();
    const recorder = new ConsoleRecorder(harness.client);

    harness.emit('Runtime.consoleAPICalled', { type: 'log', args: [{ value: 'fine' }] });
    harness.emit('Runtime.consoleAPICalled', { type: 'error', args: [{ value: 'broken' }] });
    harness.emit('Runtime.exceptionThrown', { exceptionDetails: { text: 'thrown' } });

    const errors = recorder.read(undefined, undefined, true);
    expect(errors).toHaveLength(2);
    expect(errors.every((entry) => entry.level !== 'log')).toBe(true);
  });

  it('filters to one exact level', () => {
    const harness = createClient();
    const recorder = new ConsoleRecorder(harness.client);

    harness.emit('Runtime.consoleAPICalled', { type: 'log', args: [{ value: 'a' }] });
    harness.emit('Runtime.consoleAPICalled', { type: 'info', args: [{ value: 'b' }] });

    expect(recorder.read(undefined, 'info').map((entry) => entry.text)).toEqual(['b']);
  });

  it('records a browser log entry with its source location', () => {
    const harness = createClient();
    const recorder = new ConsoleRecorder(harness.client);

    harness.emit('Log.entryAdded', {
      entry: { level: 'error', text: 'Refused to load resource', url: 'app.js', lineNumber: 41 },
    });

    const entry = recorder.read()[0];
    expect(entry?.source).toBe('log');
    expect(entry?.url).toBe('app.js');
    // Log.entryAdded lines are already 1-based, unlike stack frames.
    expect(entry?.line).toBe(41);
  });

  it('bounds its buffer and releases listeners on dispose', () => {
    const harness = createClient();
    const recorder = new ConsoleRecorder(harness.client, 5);

    for (let index = 0; index < 20; index += 1) {
      harness.emit('Runtime.consoleAPICalled', { type: 'log', args: [{ value: String(index) }] });
    }
    expect(recorder.read()).toHaveLength(5);

    recorder.dispose();
    expect(harness.listenerCount('Runtime.consoleAPICalled')).toBe(0);
  });

  it('enables both domains it depends on', async () => {
    const harness = createClient();
    await new ConsoleRecorder(harness.client).enable();

    expect(harness.requested).toEqual(['Runtime.enable', 'Log.enable']);
  });
});
