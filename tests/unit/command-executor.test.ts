import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/adapters/electron/cdp-connection', () => ({
  executeInElectron: vi.fn(),
  findElectronTarget: vi.fn(),
}));

import {
  executeInElectron,
  findElectronTarget,
} from '../../src/adapters/electron/cdp-connection';
import { sendCommandToElectron } from '../../src/adapters/electron/command-executor';

const execute = vi.mocked(executeInElectron);
const findTarget = vi.mocked(findElectronTarget);

describe('Electron command executor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findTarget.mockResolvedValue({
      id: 'target-1',
      title: 'Test',
      type: 'page',
      webSocketDebuggerUrl: 'ws://localhost/devtools/page/target-1',
    });
  });

  it('formats structured eval results after CDP returns them', async () => {
    execute.mockResolvedValue({
      type: 'object',
      value: { success: true, error: null, result: { count: 2 } },
    });

    const result = await sendCommandToElectron({
      command: 'eval',
      args: { code: '({ count: 2 })' },
    });

    expect(result).toBe('Command successful: {"count":2}');
  });

  it('rejects unsafe commands before discovering or connecting to Electron', async () => {
    await expect(
      sendCommandToElectron({
        command: 'click_by_selector',
        args: { selector: 'javascript:alert(1)' },
      }),
    ).rejects.toThrow('Invalid selector: contains dangerous content');

    expect(findTarget).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects empty wait commands before discovering or connecting to Electron', async () => {
    await expect(
      sendCommandToElectron({ command: 'wait', args: {} }),
    ).rejects.toThrow('Specify a selector, text, or duration for wait');

    expect(findTarget).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });
});
