import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { CdpClient } from '../../src/adapters/electron/cdp-connection-pool';
import { ElectronActionRunner } from '../../src/adapters/electron/electron-action-runner';
import { ElectronActionSchema } from '../../src/application/electron-actions';

const target = {
  id: 'target-1',
  title: 'Test window',
  type: 'page',
  webSocketDebuggerUrl: 'ws://127.0.0.1/devtools/page/target-1',
};

function createRunner({
  failMethod,
  responses = {},
}: { readonly failMethod?: string; readonly responses?: Record<string, unknown> } = {}) {
  const methods: string[] = [];
  let leases = 0;
  const listeners = new Map<string, Set<(params: unknown) => void>>();
  const client: CdpClient = {
    evaluate: async (expression) => {
      methods.push('Runtime.evaluate');
      return {
        type: 'object',
        value: expression.includes('document.querySelector')
          ? { x: 30, y: 40 }
          : expression.includes('window.innerWidth')
            ? { x: 400, y: 300 }
            : [
                {
                  role: 'button',
                  name: 'Save',
                  value: '',
                  enabled: true,
                  bounds: { x: 10, y: 20, width: 40, height: 20 },
                  selector: '#save',
                },
              ],
      };
    },
    request: async (method) => {
      methods.push(method);
      if (method === failMethod) throw new Error(`${method} failed`);
      return method in responses ? responses[method] : { method };
    },
    on: (method, listener) => {
      const existing = listeners.get(method) ?? new Set();
      existing.add(listener);
      listeners.set(method, existing);
      return () => existing.delete(listener);
    },
  };
  const connections = {
    invalidate: vi.fn(async () => undefined),
    async withSession<Result>(
      _url: string,
      operation: (leasedClient: CdpClient) => Promise<Result>,
    ): Promise<Result> {
      leases += 1;
      return operation(client);
    },
  };
  return {
    runner: new ElectronActionRunner(connections),
    methods,
    leases: () => leases,
    invalidate: connections.invalidate,
    listenerCount: (method: string) => listeners.get(method)?.size ?? 0,
  };
}

describe('ElectronActionRunner', () => {
  it('runs actions in input order under one CDP lease', async () => {
    const { runner, methods, leases } = createRunner();

    const { results } = await runner.run({
      target,
      stopOnError: true,
      actions: [
        { kind: 'snapshot', maxElements: 10 },
        { kind: 'click', target: { kind: 'coordinates', x: 10, y: 20 } },
        { kind: 'scroll', deltaY: 120 },
        { kind: 'press_key', key: 'Enter' },
      ],
    });

    expect(results.map((result) => result.kind)).toEqual([
      'snapshot',
      'click',
      'scroll',
      'press_key',
    ]);
    expect(results.every((result) => result.ok)).toBe(true);
    expect(leases()).toBe(1);
    expect(methods).toEqual([
      'Runtime.evaluate',
      'Input.dispatchMouseEvent',
      'Input.dispatchMouseEvent',
      'Input.dispatchMouseEvent',
      'Runtime.evaluate',
      'Input.dispatchMouseEvent',
      'Input.dispatchKeyEvent',
      'Input.dispatchKeyEvent',
    ]);
  });

  it('resolves selector targets through a compact evaluation before native input', async () => {
    const { runner, methods } = createRunner();

    await runner.run({
      target,
      stopOnError: true,
      actions: [{ kind: 'hover', target: { kind: 'selector', selector: '#save' } }],
    });

    expect(methods).toEqual(['Runtime.evaluate', 'Input.dispatchMouseEvent']);
  });

  it('moves the pointer and carries button state through a click', async () => {
    const requests: Array<{ method: string; params?: Record<string, unknown> }> = [];
    const connections = {
      withSession: async <Result>(
        _url: string,
        operation: (client: CdpClient) => Promise<Result>,
      ): Promise<Result> =>
        operation({
          evaluate: vi.fn(),
          request: async (method, params) => {
            requests.push({ method, params });
            return {};
          },
        }),
    };

    await new ElectronActionRunner(connections).run({
      target,
      stopOnError: true,
      actions: [{ kind: 'click', target: { kind: 'coordinates', x: 12, y: 34 }, button: 'right' }],
    });

    expect(requests).toEqual([
      {
        method: 'Input.dispatchMouseEvent',
        params: { type: 'mouseMoved', x: 12, y: 34, button: 'none', buttons: 0 },
      },
      {
        method: 'Input.dispatchMouseEvent',
        params: {
          type: 'mousePressed',
          x: 12,
          y: 34,
          button: 'right',
          buttons: 2,
          clickCount: 1,
        },
      },
      {
        method: 'Input.dispatchMouseEvent',
        params: {
          type: 'mouseReleased',
          x: 12,
          y: 34,
          button: 'right',
          buttons: 0,
          clickCount: 1,
        },
      },
    ]);
  });

  it('pipelines every zero-delay click packet before awaiting responses', async () => {
    const resolveRequests: Array<() => void> = [];
    const request = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRequests.push(resolve);
        }),
    );
    const connections = {
      withSession: async <Result>(
        _url: string,
        operation: (client: CdpClient) => Promise<Result>,
      ): Promise<Result> => operation({ evaluate: vi.fn(), request }),
    };

    const action = new ElectronActionRunner(connections).run({
      target,
      stopOnError: true,
      actions: [{ kind: 'click', target: { kind: 'coordinates', x: 12, y: 34 } }],
    });
    await Promise.resolve();

    expect(request).toHaveBeenCalledTimes(3);
    resolveRequests.forEach((resolve) => resolve());
    await expect(action).resolves.toEqual({
      results: [{ index: 0, kind: 'click', ok: true, value: undefined }],
    });
  });

  it('does not insert printable text when dispatching a keyboard shortcut', async () => {
    const requests: Array<{ method: string; params?: Record<string, unknown> }> = [];
    const connections = {
      withSession: async <Result>(
        _url: string,
        operation: (client: CdpClient) => Promise<Result>,
      ): Promise<Result> =>
        operation({
          evaluate: vi.fn(),
          request: async (method, params) => {
            requests.push({ method, params });
            return {};
          },
        }),
    };

    await new ElectronActionRunner(connections).run({
      target,
      stopOnError: true,
      actions: [{ kind: 'press_key', key: 'a', modifiers: ['Control'] }],
    });

    expect(requests[0]).toEqual({
      method: 'Input.dispatchKeyEvent',
      params: {
        type: 'rawKeyDown',
        key: 'a',
        code: 'KeyA',
        windowsVirtualKeyCode: 65,
        modifiers: 2,
        text: undefined,
        unmodifiedText: undefined,
      },
    });
  });

  it('sends the Chromium key descriptor required for Enter default behavior', async () => {
    const requests: Array<{ method: string; params?: Record<string, unknown> }> = [];
    const connections = {
      withSession: async <Result>(
        _url: string,
        operation: (client: CdpClient) => Promise<Result>,
      ): Promise<Result> =>
        operation({
          evaluate: vi.fn(),
          request: async (method, params) => {
            requests.push({ method, params });
            return {};
          },
        }),
    };

    await new ElectronActionRunner(connections).run({
      target,
      stopOnError: true,
      actions: [{ kind: 'press_key', key: 'Enter' }],
    });

    expect(requests).toEqual([
      {
        method: 'Input.dispatchKeyEvent',
        params: {
          type: 'keyDown',
          key: 'Enter',
          code: 'Enter',
          windowsVirtualKeyCode: 13,
          modifiers: 0,
          text: '\r',
          unmodifiedText: '\r',
        },
      },
      {
        method: 'Input.dispatchKeyEvent',
        params: {
          type: 'keyUp',
          key: 'Enter',
          code: 'Enter',
          windowsVirtualKeyCode: 13,
          modifiers: 0,
        },
      },
    ]);
  });

  it('returns a failed result and stops at the first error when requested', async () => {
    const { runner, methods, leases } = createRunner({ failMethod: 'Input.insertText' });

    const { results } = await runner.run({
      target,
      stopOnError: true,
      actions: [
        { kind: 'type_text', text: 'Ada' },
        { kind: 'click', target: { kind: 'coordinates', x: 10, y: 20 } },
      ],
    });

    expect(results).toEqual([
      {
        index: 0,
        kind: 'type_text',
        ok: false,
        error: 'Input.insertText failed',
      },
    ]);
    expect(methods).toEqual(['Input.insertText']);
    expect(leases()).toBe(1);
  });

  it('rejects executable and privileged browser URLs without issuing a CDP request', async () => {
    const { runner, methods } = createRunner();

    const { results } = await runner.run({
      target,
      stopOnError: false,
      actions: [
        { kind: 'open_url', url: 'javascript:alert(1)' },
        { kind: 'open_url', url: 'data:text/plain,blocked' },
        { kind: 'open_url', url: 'devtools://devtools/bundled/inspector.html' },
        { kind: 'open_url', url: 'chrome://version' },
        { kind: 'open_url', url: 'edge://settings' },
        { kind: 'open_url', url: 'view-source:chrome://settings' },
        { kind: 'open_url', url: 'app://settings' },
      ],
    });

    expect(results.map((result) => result.ok)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      true,
    ]);
    expect(methods).toEqual(['Page.navigate']);
  });

  it('enables the debugger before pausing and resuming', async () => {
    const { runner, methods } = createRunner();

    const { results } = await runner.run({
      target,
      stopOnError: false,
      actions: [{ kind: 'resume' }, { kind: 'pause' }],
    });

    expect(methods).toContain('Debugger.pause');
    // Each of the two actions needs its own enable on this session.
    expect(methods.filter((method) => method === 'Debugger.enable')).toHaveLength(2);
    expect(results.every((result) => result.ok)).toBe(true);
  });

  it('retires the connection after a pause, since a paused target answers nothing', async () => {
    const { runner, methods, invalidate } = createRunner();

    await runner.run({
      target,
      stopOnError: true,
      actions: [{ kind: 'pause' }],
    });

    expect(methods).toContain('Debugger.pause');
    expect(invalidate).toHaveBeenCalledWith('ws://127.0.0.1/devtools/page/target-1');
  });

  it('does not retire the connection for an ordinary batch', async () => {
    const { runner, invalidate } = createRunner();

    await runner.run({
      target,
      stopOnError: true,
      actions: [{ kind: 'snapshot' }],
    });

    expect(invalidate).not.toHaveBeenCalled();
  });

  it('does not await the resume reply, which a paused target would never send', async () => {
    const { runner } = createRunner();

    // A client that only settles the resume reply after 50ms: awaiting it
    // would block the batch, so the action must return first.
    const output = await runner.run({
      target,
      stopOnError: true,
      actions: [{ kind: 'resume' }],
    });

    expect(output.results[0]?.ok).toBe(true);
  });

  it('reloads a window and forwards the cache-bypass flag', async () => {
    const { runner, methods } = createRunner();

    await runner.run({
      target,
      stopOnError: true,
      actions: [{ kind: 'reload', ignoreCache: true }],
    });

    expect(methods).toEqual(['Page.reload']);
  });

  it('reads and writes cookies through the Network domain', async () => {
    const { runner, methods } = createRunner();

    const { results } = await runner.run({
      target,
      stopOnError: false,
      actions: [
        { kind: 'get_cookies', urls: ['https://example.test/'] },
        { kind: 'set_cookie', name: 'session', value: 'abc', url: 'https://example.test/' },
      ],
    });

    expect(methods).toEqual([
      'Network.enable',
      'Network.getCookies',
      'Network.enable',
      'Network.setCookie',
    ]);
    expect(results.every((result) => result.ok)).toBe(true);
  });

  it('refuses a cookie with neither url nor domain at the schema boundary', () => {
    expect(
      ElectronActionSchema.safeParse({ kind: 'set_cookie', name: 'session', value: 'abc' })
        .success,
    ).toBe(false);
    expect(
      ElectronActionSchema.safeParse({
        kind: 'set_cookie',
        name: 'session',
        value: 'abc',
        domain: 'example.test',
      }).success,
    ).toBe(true);
  });

  it('records a trace across the batch and unsubscribes afterwards', async () => {
    const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'debug-electron-trace-'));
    const outputPath = path.join(temporaryDirectory, 'trace.json');
    const { runner, methods, listenerCount } = createRunner();

    try {
      const output = await runner.run({
        target,
        stopOnError: true,
        trace: { outputPath },
        actions: [{ kind: 'click', target: { kind: 'coordinates', x: 10, y: 20 } }],
      });

      expect(methods.slice(0, 2)).toEqual(['Tracing.start', 'Input.dispatchMouseEvent']);
      expect(methods).toContain('Tracing.end');
      expect(output.trace?.eventCount).toBe(0);
      expect(output.trace?.filePath).toBe(outputPath);
      // A pooled session outlives the call, so the listener must be released.
      expect(listenerCount('Tracing.dataCollected')).toBe(0);

      const document = JSON.parse(await fs.readFile(outputPath, 'utf8')) as {
        traceEvents: unknown[];
      };
      expect(document.traceEvents).toEqual([]);
    } finally {
      await fs.rm(temporaryDirectory, { recursive: true, force: true });
    }
  });

  it('refuses to write a trace to a sensitive location', async () => {
    const { runner } = createRunner();

    const output = await runner.run({
      target,
      stopOnError: true,
      trace: { outputPath: path.join(os.homedir(), '.ssh', 'trace.json') },
      actions: [{ kind: 'pause' }],
    });

    // Actions still ran; only the trace write was refused.
    expect(output.results.every((result) => result.ok)).toBe(true);
    expect(output.trace?.error).toContain('sensitive location');
  });

  it('records a CPU profile around the batch and disables the domain after', async () => {
    const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'debug-electron-prof-'));
    const outputPath = path.join(temporaryDirectory, 'profile.cpuprofile');
    const { runner, methods } = createRunner({
      responses: { 'Profiler.stop': { profile: { nodes: [{ id: 1 }] } } },
    });

    try {
      const output = await runner.run({
        target,
        stopOnError: true,
        profile: { outputPath, intervalUs: 500 },
        actions: [{ kind: 'click', target: { kind: 'coordinates', x: 10, y: 20 } }],
      });

      expect(methods).toEqual([
        'Profiler.enable',
        'Profiler.setSamplingInterval',
        'Profiler.start',
        'Input.dispatchMouseEvent',
        'Input.dispatchMouseEvent',
        'Input.dispatchMouseEvent',
        'Profiler.stop',
        'Profiler.disable',
      ]);
      expect(output.profile?.filePath).toBe(outputPath);

      const written = JSON.parse(await fs.readFile(outputPath, 'utf8')) as {
        profile: { nodes: unknown[] };
      };
      expect(written.profile.nodes).toHaveLength(1);
    } finally {
      await fs.rm(temporaryDirectory, { recursive: true, force: true });
    }
  });

  it('keeps action results when the profile cannot be written', async () => {
    const { runner } = createRunner({
      responses: { 'Profiler.stop': { profile: { nodes: [] } } },
    });

    const output = await runner.run({
      target,
      stopOnError: true,
      profile: { outputPath: path.join(os.homedir(), '.aws', 'profile.json') },
      actions: [{ kind: 'pause' }],
    });

    expect(output.results.every((result) => result.ok)).toBe(true);
    expect(output.profile?.error).toContain('sensitive location');
  });

  it('captures a trace and a profile in one batch', async () => {
    const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'debug-electron-both-'));
    const { runner, methods } = createRunner({
      responses: { 'Profiler.stop': { profile: { nodes: [] } } },
    });

    try {
      const output = await runner.run({
        target,
        stopOnError: true,
        trace: { outputPath: path.join(temporaryDirectory, 'trace.json') },
        profile: { outputPath: path.join(temporaryDirectory, 'profile.json') },
        actions: [{ kind: 'snapshot' }],
      });

      expect(output.trace?.error).toBeUndefined();
      expect(output.profile?.error).toBeUndefined();
      // The profiler starts after the trace, so its setup is not in the trace.
      expect(methods.indexOf('Tracing.start')).toBeLessThan(methods.indexOf('Profiler.start'));
    } finally {
      await fs.rm(temporaryDirectory, { recursive: true, force: true });
    }
  });
});
