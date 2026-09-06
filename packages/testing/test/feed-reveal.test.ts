import { describe, expect, it } from 'vitest';
import type { BindingPath } from '@textui/core';
import { defineComponent, h, useStoreValue } from '@textui/core';
import { renderApp } from '@textui/testing';
import { Feed } from '@textui/widgets';

/*
 * A selection driven from outside, and the viewport that has to follow it.
 *
 * `reveal` was reachable only from the feed's own arrow keys, so a caller
 * moving `selectedIndex` - a search jumping to its next hit, a cursor
 * restored on the way back to a screen - moved a highlight the feed never
 * scrolled to. The row was selected and off screen, which reads as the key
 * having done nothing.
 */

const AT = '$/test/at' as BindingPath;
const PIN = '$/test/pin' as BindingPath;

const Board = defineComponent<Record<string, never>>('Board', () => {
  const at = useStoreValue<number>(AT, 0) ?? 0;
  const pin = useStoreValue<boolean>(PIN, false) ?? false;
  const rows = Array.from({ length: 30 }, (_, i) => h('text', { key: i, content: `entry ${i}` }));
  return h(Feed, { flex: 1, selectedIndex: at, pinSelection: pin }, ...rows);
});

const board = async () => {
  const t = await renderApp({ width: 40, height: 10, theme: 'workbench', root: h(Board, {}) });
  for (let i = 0; i < 6; i += 1) await t.settle();
  return t;
};

const settle = async (t: Awaited<ReturnType<typeof board>>): Promise<void> => {
  for (let i = 0; i < 6; i += 1) await t.settle();
};

describe('a feed follows a selection it does not own', () => {
  it('opens at the tail rather than at the index it was handed', async () => {
    // A caller passes an index on the way to the bottom - zero, usually - and
    // honouring it would scroll every transcript to the top of the
    // conversation instead of the end of it.
    const t = await board();
    expect(t.hasText('entry 29')).toBe(true);
    expect(t.hasText('entry 0')).toBe(false);
    await t.unmount();
  });

  it('scrolls to the selection when it moves', async () => {
    const t = await board();
    t.app.store.set(AT, 3);
    await settle(t);
    expect(t.hasText('entry 3')).toBe(true);
    await t.unmount();
  });

  it('brings a pinned selection back without it having moved', async () => {
    // The case a search lands in: the first hit is the entry the cursor is
    // already on, so the index does not change and the feed would stay where
    // it was, showing a selection somewhere else.
    const t = await board();
    expect(t.hasText('entry 0')).toBe(false);
    t.app.store.set(PIN, true);
    await settle(t);
    expect(t.hasText('entry 0')).toBe(true);
    await t.unmount();
  });

  it('leaves an unpinned feed where it is', async () => {
    const t = await board();
    t.app.store.set(PIN, false);
    await settle(t);
    expect(t.hasText('entry 29')).toBe(true);
    await t.unmount();
  });
});
