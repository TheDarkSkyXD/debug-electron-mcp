import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseElectronCommand } from '../../src/application/commands';
import { scanForElectronApps } from '../../src/adapters/electron/discovery';
import { buildRendererCommand } from '../../src/adapters/electron/renderer-command-builder';

describe('stateless MCP migration seams', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('probes discovery ports concurrently and returns them in port order', async () => {
    let active = 0;
    let maximumActive = 0;

    vi.stubGlobal('fetch', async (url: string) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 15));
      active -= 1;

      const port = Number(new URL(url).port);
      return new Response(JSON.stringify([{ id: `target-${port}`, type: 'page' }]), {
        status: 200,
      });
    });

    const apps = await scanForElectronApps([9224, 9222, 9223]);

    expect(maximumActive).toBeGreaterThan(1);
    expect(apps.map(({ port }) => port)).toEqual([9222, 9223, 9224]);
  });

  it('keeps every runtime command option through command-specific validation', () => {
    expect(parseElectronCommand('drag', { startSelector: '#source', endSelector: '#target' }))
      .toEqual({
        command: 'drag',
        args: { startSelector: '#source', endSelector: '#target' },
      });
    expect(parseElectronCommand('wait', { duration: 25, timeout: 100 })).toEqual({
      command: 'wait',
      args: { duration: 25, timeout: 100 },
    });
    expect(parseElectronCommand('type', { text: 'hello', slowly: false })).toEqual({
      command: 'type',
      args: { text: 'hello', slowly: false },
    });
    expect(() => parseElectronCommand('count', { selector: '.item', ignored: true })).toThrow();
  });

  it('builds renderer code from the same discriminated command contract', () => {
    const request = parseElectronCommand('drag', {
      startSelector: '#source',
      endSelector: '#target',
    });

    const rendererCode = buildRendererCommand(request);

    expect(rendererCode).toContain('#source');
    expect(rendererCode).toContain('#target');
  });
});
