import { describe, expect, it } from 'vitest';
import { h } from '@textui/core';
import { renderApp } from '@textui/testing';

/*
 * Picking one string out of a text, at paint time.
 *
 * Search highlighting is not a content concern: a caller that had to split
 * its text into matched and unmatched pieces would be splitting the very
 * strings the wrapper needs whole, and a paragraph broken at every hit wraps
 * differently from the paragraph it is. So the text goes in as one string and
 * the painter colours the cells that hold the term.
 */

const cellsOf = async (props: Record<string, unknown>, term: string) => {
  const t = await renderApp({ width: 40, height: 6, theme: 'workbench', root: h('text', props) });
  await t.settle();
  const y = t.lines().findIndex((line) => line.includes(term));
  if (y === -1) return null;
  const x = (t.lines()[y] as string).indexOf(term);
  return {
    hit: t.app.buffer().get(x, y),
    after: t.app.buffer().get(x + term.length, y),
    unmount: () => t.unmount(),
  };
};

describe('text picks out what it was told to look for', () => {
  it('colours the match and nothing beside it', async () => {
    const found = await cellsOf({ content: 'build on Linux today', wrap: 'word', match: 'Linux' }, 'Linux');
    expect(found).not.toBeNull();
    // The background is what changes. Compared against the cell just past the
    // term rather than against a literal, so the assertion is "different from
    // the text around it" and not "this theme's blue".
    expect(JSON.stringify(found?.hit?.bg)).not.toBe(JSON.stringify(found?.after?.bg));
    await found?.unmount();
  });

  it('matches whatever the case', async () => {
    const found = await cellsOf({ content: 'build on Linux today', wrap: 'word', match: 'linux' }, 'Linux');
    expect(JSON.stringify(found?.hit?.bg)).not.toBe(JSON.stringify(found?.after?.bg));
    await found?.unmount();
  });

  it('leaves the text alone when nothing is being looked for', async () => {
    const found = await cellsOf({ content: 'build on Linux today', wrap: 'word' }, 'Linux');
    expect(JSON.stringify(found?.hit?.bg)).toBe(JSON.stringify(found?.after?.bg));
    await found?.unmount();
  });

  it('takes the colours it is given', async () => {
    const t = await renderApp({
      width: 40, height: 6, theme: 'workbench',
      root: h('text', { content: 'build on Linux today', match: 'Linux', matchBg: 'danger' }),
    });
    await t.settle();
    const y = t.lines().findIndex((line) => line.includes('Linux'));
    const x = (t.lines()[y] as string).indexOf('Linux');
    const withDanger = JSON.stringify(t.app.buffer().get(x, y)?.bg);
    await t.unmount();

    const other = await renderApp({
      width: 40, height: 6, theme: 'workbench',
      root: h('text', { content: 'build on Linux today', match: 'Linux' }),
    });
    await other.settle();
    expect(JSON.stringify(other.app.buffer().get(x, y)?.bg)).not.toBe(withDanger);
    await other.unmount();
  });

  it('does not colour a match that a wrap broke in two', async () => {
    // The term is on no single row, so there is nothing on a row to colour.
    // Reported by leaving the text as it was rather than by guessing at half
    // of it: half a word in a search colour reads as a different match.
    const t = await renderApp({
      width: 12, height: 6, theme: 'workbench',
      root: h('text', { content: 'aaaaaaaaaa bbbbbbbbbb', wrap: 'word', match: 'aaaaaaaaaa bbbbbbbbbb' }),
    });
    await t.settle();
    const first = t.app.buffer().get(0, 0);
    const second = t.app.buffer().get(0, 1);
    expect(JSON.stringify(first?.bg)).toBe(JSON.stringify(second?.bg));
    await t.unmount();
  });
});
