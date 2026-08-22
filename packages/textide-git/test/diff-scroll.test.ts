import { describe, expect, it } from 'vitest';
import { h } from '@textui/core';
import { render } from '@textui/testing';
import { GitDiff } from '../src/diff.js';
import type { DiffMode } from '../src/diff.js';

/**
 * A diff wider than the pane it is in.
 *
 * A unified row went to `text` with no width and no slice, so a long line drew
 * past the pane and pushed what was beside it - and there was no way to see
 * the rest of it, because the arrows moved the window up and down only.
 */

/** A long line, marked, so the columns past the edge are identifiable. */
const LONG = `+${'abcdefghij'.repeat(24)}`;
const DIFF = [
  'diff --git a/wide.txt b/wide.txt',
  '@@ -1,3 +1,3 @@',
  ' context',
  '-short',
  LONG,
  ' tail',
  '',
].join('\n');

const SIZES = [
  { width: 60, height: 12 },
  { width: 100, height: 24 },
] as const;

async function open(size: { width: number; height: number }, mode: DiffMode) {
  const t = await render(
    h(GitDiff, { value: DIFF, mode, autoFocus: true, scrollbar: false }),
    size,
  );
  for (let i = 0; i < 6; i++) { await t.settle(); t.advance(50); t.flush(); }
  return t;
}

/**
 * The pane is not on its own.
 *
 * A row too wide for its box does not spill visibly - the buffer is the size
 * of the terminal and clips it - so looking at the diff alone shows nothing
 * wrong. What it does is push its siblings, and the sidebar is a box with an
 * explicit width and `shrink: 1`, so the thing that gives way is the sidebar.
 * That is the shape of the bug, so it is the shape of the test.
 */
describe.each(SIZES)('beside something else at $width x $height', (size) => {
  const LABEL = 'SIDEBAR-KEEPS-THIS';

  it.each(['unified', 'split'] as const)('does not crush its neighbour in %s', async (mode) => {
    const t = await render(
      h('box', { direction: 'row', width: size.width, height: size.height },
        h('box', { width: 20, direction: 'column' }, h('text', { content: LABEL })),
        h(GitDiff, { value: DIFF, mode, autoFocus: true, scrollbar: false, flex: 1 })),
      size,
    );
    for (let i = 0; i < 6; i++) { await t.settle(); t.advance(50); t.flush(); }

    expect(t.hasText(LABEL), 'the neighbour still has its columns').toBe(true);
    await t.unmount();
  });
});

describe.each(SIZES)('a diff at $width x $height', (size) => {
  it.each(['unified', 'split'] as const)('keeps every row inside the pane in %s', async (mode) => {
    const t = await open(size, mode);
    for (const line of t.lines()) {
      expect(line.length, `"${line.slice(0, 30)}..." is ${line.length} of ${size.width}`)
        .toBeLessThanOrEqual(size.width);
    }
    await t.unmount();
  });

  it('shows the far end of a long line when panned right', async () => {
    const t = await open(size, 'unified');
    const at = (): string => t.lines().find((l) => l.includes('abcdefghij')) ?? '';

    const before = at();
    expect(before, 'the start of the long line is on screen').toContain('+abcdefghij');

    // Eight presses of four columns is past anything this pane can hold.
    for (let i = 0; i < 8; i++) t.press('right');
    await t.settle();

    const after = at();
    expect(after, 'panning moved the window').not.toBe(before);
    expect(after, 'and the marker is no longer the first cell').not.toContain('+abcdefghij');

    for (let i = 0; i < 20; i++) t.press('left');
    await t.settle();
    expect(at(), 'left comes all the way back').toBe(before);
    await t.unmount();
  });

  it('never pans past the longest line', async () => {
    const t = await open(size, 'unified');
    for (let i = 0; i < 200; i++) t.press('right');
    await t.settle();
    // Something of the long line is always still on screen: the clamp is
    // `longest - width`, so the last column can reach the edge and no further.
    expect(t.lines().some((l) => l.includes('abcdefghij') || l.includes('abcde'))).toBe(true);
    await t.unmount();
  });
});

describe('the caret', () => {
  /** A diff taller than any pane here, so the window has somewhere to go. */
  const tall = ['@@ -1,40 +1,40 @@', ...Array.from({ length: 40 }, (_, i) => ` line ${i}`), ''];

  async function open(size: { width: number; height: number }) {
    const t = await render(
      h(GitDiff, { value: tall.join('\n'), mode: 'unified', autoFocus: true, scrollbar: false }),
      size,
    );
    for (let i = 0; i < 6; i++) { await t.settle(); t.advance(50); t.flush(); }
    return t;
  }

  it.each(SIZES)('leads the window down at $width x $height', async (size) => {
    const t = await open(size);
    expect(t.hasText('line 0'), 'starts at the top').toBe(true);

    for (let i = 0; i < size.height + 4; i++) t.press('down');
    await t.settle();

    expect(t.hasText('line 0'), 'the top has scrolled away').toBe(false);
    await t.unmount();
  });

  /*
   * The difference between a caret that leads and arrows that scroll.
   *
   * At the foot of the diff, one press of `up` moves the caret off the last
   * row and leaves the window where it is. Moving the window instead scrolls
   * the last line off the bottom - which is what it used to do, and why you
   * could not sit on a line and look at it.
   */
  it.each(SIZES)('up moves the caret, not the window, at $width x $height', async (size) => {
    const t = await open(size);
    t.press('end');
    await t.settle();
    expect(t.hasText('line 39'), 'end reaches the last row').toBe(true);

    t.press('up');
    await t.settle();
    expect(t.hasText('line 39'), 'and the window stayed put').toBe(true);
    await t.unmount();
  });

  it.each(SIZES)('end goes to the last row and home comes back at $width x $height', async (size) => {
    const t = await open(size);
    t.press('end');
    await t.settle();
    expect(t.hasText('line 39')).toBe(true);

    t.press('home');
    await t.settle();
    expect(t.hasText('line 0')).toBe(true);
    expect(t.hasText('line 39')).toBe(false);
    await t.unmount();
  });
});
