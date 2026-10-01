import { describe, expect, it } from 'vitest';
import { h } from '@textui/core';
import { KeyValue } from '@textui/widgets';
import { renderApp } from '../src/index.js';
import type { Harness } from '../src/index.js';

/**
 * The two room knobs and the two alignment knobs, read off the frame.
 *
 * The column is exact - as wide as the longest label - so what `labelGap` buys
 * and where an aligned pair sits are both visible as cell positions, which is
 * the only way to check a layout.
 */

const ITEMS = [
  { label: 'a', value: 'one' },
  { label: 'longer', value: 'two' },
];

const open = async (props: Record<string, unknown> = {}): Promise<Harness> => {
  const t = await renderApp({
    width: 40,
    height: 6,
    theme: 'dark',
    root: h(KeyValue, { items: ITEMS, ...props }),
  });
  await t.settle();
  return t;
};

/** Where `text` starts on the row that holds it. */
const col = (t: Harness, text: string): number => {
  const row = t.lines().find((line) => line.includes(text));
  if (row === undefined) throw new Error(`no row with ${text}`);
  return row.indexOf(text);
};

describe('KeyValue', () => {
  it('starts every value one gap after the longest label', async () => {
    const t = await open();
    // `longer` is six cells, then the pair's own gap.
    expect(col(t, 'one')).toBe(7);
    expect(col(t, 'two')).toBe(7);
    await t.unmount();
  });

  it('adds labelGap to the widest label', async () => {
    const t = await open({ labelGap: 3 });
    expect(col(t, 'one')).toBe(10);
    expect(col(t, 'two')).toBe(10);
    await t.unmount();
  });

  it('takes a stated width as exact, whatever the gap says', async () => {
    const t = await open({ labelWidth: 4, labelGap: 3 });
    expect(col(t, 'one')).toBe(5);
    await t.unmount();
  });

  it('right-aligns the labels when asked, for the block', async () => {
    const t = await open({ labelAlign: 'right' });
    // `a` ends at the column's edge, so it starts five cells in.
    expect(col(t, 'a')).toBe(5);
    expect(col(t, 'longer')).toBe(0);
    await t.unmount();
  });

  it('right-aligns one pair without moving the label of the other', async () => {
    const t = await open({
      items: [
        { label: 'a', value: 'one', labelAlign: 'right' },
        { label: 'longer', value: 'two', labelAlign: 'left' },
      ],
      labelAlign: 'left',
    });
    expect(col(t, 'a')).toBe(5);
    expect(col(t, 'longer')).toBe(0);
    await t.unmount();
  });

  it('right-aligns the values when asked, and per item', async () => {
    // Different lengths, because a value that ends where another ends by
    // accident proves nothing.
    const items = [
      { label: 'a', value: 'one' },
      { label: 'longer', value: 'twenty-two' },
    ];
    const ends = (t: Harness): number[] => ['one', 'twenty-two'].map((value) => {
      const row = t.lines().find((line) => line.includes(value));
      if (row === undefined) throw new Error(`no row with ${value}`);
      return row.indexOf(value) + value.length;
    });
    const left = await open({ items });
    const right = await open({ items, valueAlign: 'right' });
    const [oneLeft, twoLeft] = ends(left);
    const [oneRight, twoRight] = ends(right);
    if (oneLeft === undefined || twoLeft === undefined || oneRight === undefined || twoRight === undefined) {
      throw new Error('a value was not drawn at all');
    }
    expect(oneLeft).not.toBe(twoLeft);
    expect(oneRight).toBe(twoRight);
    expect(oneRight).toBeGreaterThan(oneLeft);
    await left.unmount();
    await right.unmount();

    const mixed = await open({
      items: [
        { label: 'a', value: 'one', valueAlign: 'right' },
        { label: 'longer', value: 'twenty-two', valueAlign: 'left' },
      ],
    });
    expect(col(mixed, 'one')).toBeGreaterThan(col(mixed, 'twenty-two'));
    await mixed.unmount();
  });
});
