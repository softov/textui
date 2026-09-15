import { describe, expect, it } from 'vitest';
import { h } from '@textui/core';
import { renderApp } from '@textui/testing';
import type { Harness } from '@textui/testing';
import { FileDiff, diffLines } from '../src/index.js';

/**
 * One file, both sides lined up.
 *
 * The diff itself is `diffLines`, tested on its own. What is checked here is
 * what the view makes of a result: the header's counts, both gutters, and the
 * three things it says instead of a diff.
 */

const open = async (props: Record<string, unknown>): Promise<Harness> => {
  // Given its height: the rows scroll inside it, and a column nobody sized
  // shows one of them.
  const t = await renderApp({
    width: 60,
    height: 12,
    root: h(FileDiff, { path: 'src/a.ts', kind: 'edited', height: 12, ...props }),
  });
  await t.settle();
  return t;
};

describe('a file diff', () => {
  it('heads with the path and the counts, then numbers both sides', async () => {
    const t = await open({ diff: diffLines('one\ntwo\nthree\n', 'one\n2\nthree\nfour\n') });
    const head = t.lines()[0] ?? '';
    expect(head).toContain('src/a.ts');
    expect(head).toContain('+2');
    expect(head).toContain('-1');
    expect(t.hasText('two')).toBe(true);
    expect(t.hasText('four')).toBe(true);
    // The removed line has a left number and no right one; the added one the
    // reverse. Both columns are there on every row.
    const removed = t.lines().find((l) => l.includes('two')) ?? '';
    const added = t.lines().find((l) => l.includes('four')) ?? '';
    expect(removed.trim().startsWith('2')).toBe(true);
    expect(added.trim().startsWith('4')).toBe(true);
    await t.unmount();
  });

  it('marks a creation and a deletion at the head', async () => {
    const created = await open({ kind: 'new', diff: diffLines('', 'a\n') });
    expect((created.lines()[0] ?? '').trim().startsWith('+')).toBe(true);
    await created.unmount();
    const deleted = await open({ kind: 'deleted', diff: diffLines('a\n', '') });
    expect((deleted.lines()[0] ?? '').trim().startsWith('-')).toBe(true);
    await deleted.unmount();
  });

  it('says when there is nothing on either side', async () => {
    const t = await open({ diff: diffLines('', '') });
    expect(t.hasText('Nothing between the two')).toBe(true);
    await t.unmount();
  });

  it('says when the pair was too big to line up', async () => {
    const t = await open({ diff: diffLines('a\n'.repeat(30), 'b\n'.repeat(30), 20) });
    expect(t.hasText('Too big to line up')).toBe(true);
    await t.unmount();
  });

  it('says what a binary file is instead of showing it', async () => {
    const t = await open({ diff: diffLines('', ''), binary: { bytes: 2048, contentType: 'image/png' } });
    expect(t.hasText('image/png, 2048 bytes')).toBe(true);
    await t.unmount();
  });
});
