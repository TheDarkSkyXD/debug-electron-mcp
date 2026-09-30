import { afterEach, describe, expect, it, vi } from 'vitest';
import { scanForElectronApps } from '../../src/adapters/electron/discovery';
import { ProjectRegistry } from '../../src/application/project-registry';

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Serve the DevTools target list so a probed port looks like a live app. */
function stubDevToolsFor(ports: readonly number[]): Set<number> {
  const probed = new Set<number>();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL) => {
      const port = Number(new URL(String(input)).port);
      probed.add(port);
      if (!ports.includes(port)) {
        return { ok: false, status: 404, json: async () => [] } as unknown as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => [
          {
            id: 'page-1',
            type: 'page',
            title: 'Fake App',
            url: 'http://localhost/',
            webSocketDebuggerUrl: 'ws://127.0.0.1/devtools/page/page-1',
          },
        ],
      } as unknown as Response;
    }),
  );
  return probed;
}

describe('default discovery range', () => {
  it('probes every port the project registry can allocate', async () => {
    const registry = new ProjectRegistry({ load: () => undefined, save: () => undefined });
    // Allocate the whole range so the test fails if discovery covers less.
    const allocated: number[] = [];
    for (let index = 0; index < 101; index += 1) {
      allocated.push(registry.register(`project-${index}`).port);
    }
    expect(allocated).toHaveLength(101);
    // The last project sits past the old hardcoded four-port subset.
    const latePort = allocated.at(-1) as number;
    expect(latePort).toBe(9322);

    const probed = stubDevToolsFor([latePort]);
    const results = await scanForElectronApps();

    // Every allocated port must be reachable by a bare, unscoped call.
    for (const port of allocated) {
      expect(probed.has(port)).toBe(true);
    }
    expect(results.map((app) => app.port)).toEqual([latePort]);
  });

  it('finds an app on a late-range port that the old subset missed', async () => {
    const latePort = 9300;
    const probed = stubDevToolsFor([latePort]);

    const results = await scanForElectronApps();

    expect(probed.has(latePort)).toBe(true);
    expect(results).toHaveLength(1);
  });

  it('honours an explicit port list without probing anything else', async () => {
    const probed = stubDevToolsFor([9231]);

    const results = await scanForElectronApps([9231]);

    expect(results.map((app) => app.port)).toEqual([9231]);
    expect([...probed]).toEqual([9231]);
  });

  it('returns nothing when no probed port has an app', async () => {
    stubDevToolsFor([]);

    await expect(scanForElectronApps([1, 2, 3])).resolves.toEqual([]);
  });
});
