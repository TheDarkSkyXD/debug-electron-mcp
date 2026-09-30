import { describe, expect, it } from 'vitest';
import {
  ElectronActionBatchSchema,
  ElectronActionSchema,
} from '../../src/application/electron-actions';

describe('ElectronActionSchema', () => {
  it('parses every action variant at the transport boundary', () => {
    const actions = [
      { kind: 'snapshot', maxElements: 10 },
      { kind: 'click', target: { kind: 'coordinates', x: 1, y: 2 } },
      { kind: 'double_click', target: { kind: 'selector', selector: '#save' } },
      { kind: 'long_press', target: { kind: 'selector', selector: '#save' }, durationMs: 100 },
      { kind: 'hover', target: { kind: 'coordinates', x: 1, y: 2 } },
      { kind: 'scroll', deltaX: 0, deltaY: 20 },
      { kind: 'type_text', text: 'Ada', selector: '#name' },
      { kind: 'press_key', key: 'Enter', modifiers: ['Control'] },
      { kind: 'open_url', url: 'app://settings' },
      { kind: 'command', command: 'get_title', args: {} },
    ];

    expect(actions.map((action) => ElectronActionSchema.parse(action).kind)).toEqual(
      actions.map((action) => action.kind),
    );
  });

  it('rejects invalid bounds and impossible action shapes', () => {
    expect(() => ElectronActionSchema.parse({ kind: 'snapshot', maxElements: 0 })).toThrow();
    expect(() =>
      ElectronActionSchema.parse({
        kind: 'click',
        target: { kind: 'coordinates', x: Number.NaN, y: 10 },
      }),
    ).toThrow();
    expect(() =>
      ElectronActionSchema.parse({ kind: 'press_key', key: '', modifiers: ['Ctrl'] }),
    ).toThrow();
    expect(() =>
      ElectronActionSchema.parse({ kind: 'scroll', deltaY: Number.POSITIVE_INFINITY }),
    ).toThrow();
    expect(() => ElectronActionBatchSchema.parse([])).toThrow();
    expect(() =>
      ElectronActionBatchSchema.parse(Array.from({ length: 51 }, () => ({ kind: 'snapshot' }))),
    ).toThrow();
  });
});
