import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { expect, describe, it, vi } from 'vitest';
import {
  takeScreenshot,
  type ScreenshotDependencies,
} from '../../src/adapters/electron/screenshot';

function createDependencies(data = Buffer.from('PNG_DATA').toString('base64')): {
  readonly dependencies: ScreenshotDependencies;
  readonly request: ReturnType<typeof vi.fn>;
  readonly withSession: ReturnType<typeof vi.fn>;
  readonly withTarget: ReturnType<typeof vi.fn>;
} {
  const request = vi.fn().mockResolvedValue({ data });
  const withSession = vi.fn(
    async (_url: string, operation: (client: { request: typeof request }) => Promise<unknown>) =>
      operation({ request }),
  );
  const target = {
    id: 'main',
    title: 'My App',
    type: 'page',
    webSocketDebuggerUrl: 'ws://127.0.0.1/devtools/page/main',
  };
  const withTarget = vi.fn(
    async (_options, operation: (resolvedTarget: typeof target) => Promise<unknown>) =>
      operation(target),
  );
  return {
    dependencies: { connections: { withSession }, withTarget },
    request,
    withSession,
    withTarget,
  };
}

describe('takeScreenshot', () => {
  it('captures an inline PNG through the pooled CDP client', async () => {
    const { dependencies, request, withSession, withTarget } = createDependencies();

    const result = await takeScreenshot({}, dependencies);

    expect(result).toEqual({
      kind: 'inline',
      base64: Buffer.from('PNG_DATA').toString('base64'),
      bytes: Buffer.byteLength('PNG_DATA'),
      mimeType: 'image/png',
    });
    expect(withTarget).toHaveBeenCalledWith({}, expect.any(Function));
    expect(withSession).toHaveBeenCalledWith(
      'ws://127.0.0.1/devtools/page/main',
      expect.any(Function),
    );
    expect(request).toHaveBeenCalledWith('Page.captureScreenshot', { format: 'png' });
  });

  it('creates missing parent directories for an explicit output path', async () => {
    const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'debug-electron-shot-'));
    const outputPath = path.join(temporaryDirectory, 'nested', 'screenshots', 'window.png');
    const { dependencies } = createDependencies();

    try {
      const result = await takeScreenshot({ outputPath }, dependencies);

      expect(result).toEqual({
        kind: 'file',
        filePath: outputPath,
        bytes: Buffer.byteLength('PNG_DATA'),
        mimeType: 'image/png',
      });
      await expect(fs.readFile(outputPath, 'utf8')).resolves.toBe('PNG_DATA');
    } finally {
      await fs.rm(temporaryDirectory, { recursive: true, force: true });
    }
  });

  it('requests JPEG with quality when the caller asks for it', async () => {
    const { dependencies, request } = createDependencies();

    await takeScreenshot({ format: 'jpeg', quality: 70 }, dependencies);

    expect(request).toHaveBeenCalledWith('Page.captureScreenshot', {
      format: 'jpeg',
      quality: 70,
    });
  });

  it('omits quality for PNG because the format does not accept it', async () => {
    const { dependencies, request } = createDependencies();

    await takeScreenshot({ format: 'png', quality: 70 }, dependencies);

    expect(request).toHaveBeenCalledWith('Page.captureScreenshot', { format: 'png' });
  });

  it('clips a screenshot to the on-screen box of a matched element', async () => {
    const { dependencies, request, withSession } = createDependencies();
    const evaluate = vi.fn().mockResolvedValue({
      value: { x: 10, y: 20, width: 200, height: 100, viewportWidth: 800, viewportHeight: 600 },
    });
    withSession.mockImplementationOnce(async (_url, operation) =>
      operation({ request, evaluate }),
    );

    await takeScreenshot({ selector: '#sidebar' }, dependencies);

    expect(request).toHaveBeenCalledWith('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 10, y: 20, width: 200, height: 100, scale: 1 },
      captureBeyondViewport: false,
    });
  });

  it('cuts an oversized element down to the viewport instead of capturing the whole window', async () => {
    const { dependencies, request, withSession } = createDependencies();
    const evaluate = vi.fn().mockResolvedValue({
      value: { x: 0, y: -40, width: 200, height: 900, viewportWidth: 800, viewportHeight: 600 },
    });
    withSession.mockImplementationOnce(async (_url, operation) =>
      operation({ request, evaluate }),
    );

    await takeScreenshot({ selector: '#tall' }, dependencies);

    expect(request).toHaveBeenCalledWith('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 0, y: 0, width: 200, height: 600, scale: 1 },
      captureBeyondViewport: false,
    });
  });

  it('fails a clipped screenshot when the element is scrolled out of view', async () => {
    const { dependencies, request, withSession } = createDependencies();
    const evaluate = vi.fn().mockResolvedValue({
      value: { x: 0, y: 900, width: 200, height: 100, viewportWidth: 800, viewportHeight: 600 },
    });
    withSession.mockImplementationOnce(async (_url, operation) =>
      operation({ request, evaluate }),
    );

    await expect(takeScreenshot({ selector: '#below-fold' }, dependencies)).rejects.toThrow(
      'outside the viewport',
    );
    expect(request).not.toHaveBeenCalled();
  });

  it('refuses to write a screenshot to a sensitive system location', async () => {
    const { dependencies, request, withTarget } = createDependencies();
    const blocked = path.join(os.homedir(), '.ssh', 'authorized_keys');

    await expect(takeScreenshot({ outputPath: blocked }, dependencies)).rejects.toThrow(
      'sensitive location',
    );
    // The guard runs before the capture, so a refused path costs no round trip.
    expect(withTarget).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });

  it('preserves the selected target and rejects malformed CDP responses', async () => {
    const { dependencies, request, withTarget } = createDependencies();
    request.mockResolvedValueOnce({});

    await expect(takeScreenshot({ targetId: 'settings' }, dependencies)).rejects.toThrow(
      'malformed screenshot response',
    );
    expect(withTarget).toHaveBeenCalledWith({ targetId: 'settings' }, expect.any(Function));
  });

  it('fails when the selected target has no CDP WebSocket URL', async () => {
    const { dependencies, withSession, withTarget } = createDependencies();
    withTarget.mockImplementationOnce(async (_options, operation) =>
      operation({ id: 'main', title: 'My App', type: 'page' }),
    );

    await expect(takeScreenshot({}, dependencies)).rejects.toThrow(
      'No WebSocket debugger URL available',
    );
    expect(withSession).not.toHaveBeenCalled();
  });
});
