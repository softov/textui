import { describe, expect, it } from 'vitest';
import { h } from '@textui/core';
import { List } from '@textui/widgets';
import { renderApp } from '../src/index.js';

/**
 * What a narrow row gives up first.
 *
 * All three columns used to shrink together, so a catalogue at 58 columns cut
 * the label to "Kqueue events on Li…" *and* the status to "waiting on y…" to
 * keep a workspace path nobody was scanning for. The elaboration is the part
 * that yields: the label is the thing being chosen and the meta is the column
 * the row is being read for.
 */
describe('a List row under pressure', () => {
  const open = async (width: number) => {
    const t = await renderApp({
      width,
      height: 6,
      root: h(List, {
        items: [{
          id: 'a',
          label: 'Kqueue events on Linux',
          description: 'claude  ·  brb_framework',
          meta: 'waiting on you',
        }],
      }),
    });
    await t.settle();
    return t;
  };

  it('keeps the label and the status, and cuts the description', async () => {
    const t = await open(58);
    const row = t.line(0);

    expect(row).toContain('Kqueue events on Linux');
    expect(row).toContain('waiting on you');
    // The one that gave way, and it did give way - otherwise this is only a
    // test that 58 columns was enough for all three.
    expect(row).not.toContain('brb_framework');
    await t.unmount();
  });

  it('draws all three when there is room', async () => {
    const t = await open(90);
    const row = t.line(0);

    expect(row).toContain('Kqueue events on Linux');
    expect(row).toContain('brb_framework');
    expect(row).toContain('waiting on you');
    await t.unmount();
  });
});
