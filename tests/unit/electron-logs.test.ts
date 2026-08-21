import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/utils/electron-connection', () => ({
  findElectronTarget: vi.fn().mockRejectedValue(new Error('DevTools unavailable')),
  connectForLogs: vi.fn(),
}));

import { readElectronLogs } from '../../src/utils/electron-logs';

describe('Electron log fallback', () => {
  it.runIf(process.platform !== 'darwin')(
    'returns an honest bounded message where system log collection is unsupported',
    async () => {
      await expect(readElectronLogs('main', 25)).resolves.toBe(
        `System Electron log fallback is unavailable on ${process.platform}. ` +
          'Start Electron with --remote-debugging-port=9222 to read a bounded console snapshot.',
      );
    },
  );
});
