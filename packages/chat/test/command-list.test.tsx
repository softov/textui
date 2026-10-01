import { describe, expect, it } from 'vitest';
import { h } from '@textui/core';
import { renderApp } from '@textui/testing';
import type { Harness } from '@textui/testing';
import { CommandList } from '../src/index.js';
import type { CommandItem } from '../src/index.js';

/**
 * The command menu as its own component: one name column, and a description
 * that is one line, or as many as the caller allows.
 *
 * The column and the wrap are both layout, so both are read off the frame:
 * where a description starts is where the column ended, and how many lines a
 * description took is how tall the row is.
 */

const ITEMS: CommandItem[] = [
  {
    id: 'security-review',
    label: '/security-review',
    description: 'Complete a security review of the pending changes on the current branch',
    meta: 'security-review',
  },
  { id: 'simplify', label: '/simplify', description: 'Review the changed code for reuse', meta: 'simplify' },
  { id: 'usage', label: '/usage', description: 'Show session cost', meta: 'usage' },
];

const open = async (props: Record<string, unknown> = {}, width = 100): Promise<Harness> => {
  const t = await renderApp({
    width,
    height: 14,
    theme: 'workbench',
    root: h(CommandList, { items: ITEMS, marker: true, ...props }),
  });
  await t.settle();
  await t.settle();
  return t;
};

/** Where `text` starts, on the row that holds it. */
const col = (t: Harness, text: string): number => {
  const row = t.lines().find((line) => line.includes(text));
  if (row === undefined) throw new Error(`no row with ${text}`);
  return row.indexOf(text);
};

/** Which line a row is drawn on. */
const lineOf = (t: Harness, text: string): number =>
  t.lines().findIndex((line) => line.includes(text));

describe('the command list', () => {
  it('starts every description at the same cell', async () => {
    const t = await open();
    const at = ['Complete a', 'Review the', 'Show session'].map((text) => col(t, text));
    expect(new Set(at).size).toBe(1);
    // The name column is a floor, so `/security-review` at sixteen cells is
    // padded out to twenty and the descriptions follow it.
    expect(at[0]).toBe(col(t, '/security-review') + 20 + 1);
    await t.unmount();
  });

  it('takes the caller\'s name width as the floor', async () => {
    const t = await open({ commandWidth: 30 });
    expect(col(t, 'Complete a')).toBe(col(t, '/security-review') + 30 + 1);
    await t.unmount();
  });

  it('draws a description on one line by default, cut with the ellipsis', async () => {
    const t = await open();
    expect(lineOf(t, '/simplify')).toBe(1);
    // Cut before the source column beside it, and the cut is marked.
    expect(t.lines()[0]).toContain('…');
    await t.unmount();
  });

  it('wraps a description into the lines it is allowed, and says it was cut', async () => {
    // Narrower than the description, so two lines cannot hold it and the
    // second has to say there was more.
    const t = await open({ descriptionLines: 2, wrapDescription: true }, 60);
    // Two lines for the first row, so the second row starts on line two.
    expect(lineOf(t, '/simplify')).toBe(2);
    expect(t.lines()[1]?.trimEnd().endsWith('…')).toBe(true);
    expect(t.lines()[0]).not.toContain('…');
    await t.unmount();
  });

  it('buys no lines for a description that may not wrap', async () => {
    const t = await open({ descriptionLines: 3, wrapDescription: false });
    expect(lineOf(t, '/simplify')).toBe(1);
    await t.unmount();
  });

  it('fits rows into the lines the menu was given', async () => {
    // Two-line rows in four lines is two rows, not four.
    const t = await open({ descriptionLines: 2, wrapDescription: true, availableLines: 4 });
    expect(lineOf(t, '/security-review')).toBe(0);
    expect(lineOf(t, '/simplify')).toBe(2);
    expect(lineOf(t, '/usage')).toBe(-1);
    await t.unmount();
  });
});
