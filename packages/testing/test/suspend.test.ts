import { describe, expect, it } from 'vitest';
import { h, useStoreValue } from '@textui/core';
import { renderApp } from '../src/index.js';

/*
 * What `suspend` hands over is the whole terminal.
 *
 * An editor, a pager or a shell draws for itself while it runs. A frame this
 * application rendered meanwhile, because the store changed or an animation
 * ticked, would be written over that program's screen.
 */

const PATH = '$/suspend/label' as const;

const shown = () => h(function Shown() {
  return h('text', { content: useStoreValue<string>(PATH, 'before') ?? 'before' });
}, {});

describe('suspend', () => {
  it('writes nothing while another program has the terminal, and shows what changed once it is back', async () => {
    const t = await renderApp({ width: 30, height: 4, root: shown(), encode: true });
    expect(t.hasText('before')).toBe(true);
    t.clearOutput();
    let during = '';
    let frame = '';
    await t.app.suspend(async () => {
      t.store.set(PATH, 'changed while away');
      await new Promise((resolve) => setTimeout(resolve, 60));
      during = t.output();
      frame = t.text();
    });
    expect(during).toBe('');
    expect(frame).toContain('before');
    expect(t.hasText('changed while away')).toBe(true);
    await t.app.stop();
  });

  it('renders again when the program it ran fails', async () => {
    const t = await renderApp({ width: 30, height: 4, root: shown() });
    await expect(t.app.suspend(async () => {
      t.store.set(PATH, 'set before the failure');
      throw new Error('the editor failed');
    })).rejects.toThrow('the editor failed');
    expect(t.hasText('set before the failure')).toBe(true);
    await t.app.stop();
  });
});
