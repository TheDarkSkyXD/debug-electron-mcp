import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseDebugPortFromCommand } from '../../src/adapters/electron/app-lifecycle';
import { resolveOutputPath } from '../../src/adapters/electron/output-paths';
import { buildRendererCommand } from '../../src/adapters/electron/renderer-command-builder';
import { parseElectronCommand } from '../../src/application/commands';

describe('output path guard', () => {
  it('blocks writes under the user credential directory', () => {
    expect(() => resolveOutputPath(`${process.env.HOME ?? '~'}/.ssh/authorized_keys`, 'X')).toThrow();
  });

  it('rejects a blocked root prefix rather than an exact match', () => {
    const home = process.env.USERPROFILE ?? process.env.HOME ?? '';
    if (!home) return;
    expect(() => resolveOutputPath(`${home}/.ssh/nested/deep/file.png`, 'X')).toThrow(
      'sensitive location',
    );
  });

  it('allows a normal temp path when no allowlist is configured', () => {
    expect(resolveOutputPath('relative/screenshot.png', 'DEBUG_ELECTRON_MCP_ABSENT')).toMatch(
      /screenshot\.png$/,
    );
  });

  it('restricts output to the allowlist when one is configured', async () => {
    const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'debug-electron-roots-'));
    const allowedDirectory = path.join(temporaryDirectory, 'allowed');
    const previous = process.env.DEBUG_ELECTRON_MCP_OUTPUT_ROOTS;
    process.env.DEBUG_ELECTRON_MCP_OUTPUT_ROOTS = allowedDirectory;
    try {
      const inside = resolveOutputPath(
        path.join(allowedDirectory, 'shot.png'),
        'DEBUG_ELECTRON_MCP_OUTPUT_ROOTS',
      );
      expect(inside).toBe(path.join(allowedDirectory, 'shot.png'));

      // A sibling directory sharing a name prefix must not pass as inside.
      expect(() =>
        resolveOutputPath(
          path.join(temporaryDirectory, 'elsewhere', 'shot.png'),
          'DEBUG_ELECTRON_MCP_OUTPUT_ROOTS',
        ),
      ).toThrow('outside DEBUG_ELECTRON_MCP_OUTPUT_ROOTS');
    } finally {
      if (previous === undefined) delete process.env.DEBUG_ELECTRON_MCP_OUTPUT_ROOTS;
      else process.env.DEBUG_ELECTRON_MCP_OUTPUT_ROOTS = previous;
      await fs.rm(temporaryDirectory, { recursive: true, force: true });
    }
  });
});

describe('debug port parsing', () => {
  it('reads the port from an equals-style flag', () => {
    expect(parseDebugPortFromCommand('electron . --remote-debugging-port=9222')).toBe(9222);
  });

  it('reads the port from a space-separated flag', () => {
    expect(parseDebugPortFromCommand('electron . --remote-debugging-port 9333')).toBe(9333);
  });

  it('returns undefined when no port was passed', () => {
    expect(parseDebugPortFromCommand('electron .')).toBeUndefined();
  });
});

describe('inspection and wait commands', () => {
  it('builds a page info probe covering the fields a debugger needs', () => {
    const script = buildRendererCommand(parseElectronCommand('page_info', {}));
    for (const field of ['readyState', 'visibilityState', 'userAgent', 'viewport']) {
      expect(script).toContain(field);
    }
  });

  it('builds a selector-scoped DOM read', () => {
    const script = buildRendererCommand(
      parseElectronCommand('get_dom', { selector: '#root' }),
    );
    expect(script).toContain('querySelector');
    expect(script).toContain('outerHTML');
  });

  it('reads the whole document when no selector is given', () => {
    const script = buildRendererCommand(parseElectronCommand('get_dom', {}));
    expect(script).toContain('documentElement.outerHTML');
  });

  it('honours the query_selector result limit', () => {
    const script = buildRendererCommand(
      parseElectronCommand('query_selector', { selector: 'li', limit: 5 }),
    );
    expect(script).toContain('slice(0, 5)');
  });

  it('combines several wait conditions into one poll', () => {
    const script = buildRendererCommand(
      parseElectronCommand('wait', {
        selector: '#done',
        hidden: '.spinner',
        text: 'Welcome',
        urlIncludes: '#/home',
        minCount: 3,
      }),
    );
    for (const condition of ['selector:#done', 'hidden:.spinner', 'text:Welcome', 'url:#/home']) {
      expect(script).toContain(condition);
    }
    expect(script).toContain('count:#done>=3');
  });

  it('rejects a wait that asks only for a count with no selector to count', () => {
    expect(() => buildRendererCommand(parseElectronCommand('wait', { minCount: 3 }))).toThrow(
      'minCount requires a selector',
    );
  });

  it('rejects a wait with no conditions at all', () => {
    expect(() => buildRendererCommand(parseElectronCommand('wait', {}))).toThrow(
      'Specify a selector, text, duration, hidden, enabled, urlIncludes, or minCount',
    );
  });

  it('emits wait conditions as real code so a strict CSP does not break them', async () => {
    const script = buildRendererCommand(
      parseElectronCommand('wait', { selector: '#done', hidden: '.spinner', minCount: 2 }),
    );

    // An Electron renderer often forbids eval, so the probe must not depend on it.
    expect(script).not.toMatch(/\beval\s*\(/);

    // Execute under a policy that throws on eval, as a strict renderer would.
    // Trim first: a leading newline after `return` would trigger automatic
    // semicolon insertion and yield undefined.
    const probeSource = script.replace(/;\s*$/, '').trim();
    const evaluate = new Function(
      'document',
      'window',
      'setTimeout',
      `"use strict"; return ${probeSource};`,
    );
    const body = { innerText: 'Ready' };
    const documentStub = {
      body,
      querySelector: (selector: string) =>
        selector === '#done' ? { getBoundingClientRect: () => ({ width: 10, height: 10 }) } : null,
      querySelectorAll: () => [{}, {}],
    };
    const probe = evaluate(
      documentStub,
      { getComputedStyle: () => ({ display: 'none' }) },
      globalThis.setTimeout.bind(globalThis),
    );
    await expect(probe).resolves.toContain(
      'Matched selector:#done, hidden:.spinner, count:#done>=2',
    );
  });
});
