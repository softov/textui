import { describe, expect, it } from 'vitest';
import { h } from '@textui/core';
import { MarkdownView } from '@textui/widgets';
import { renderApp } from '../src/index.js';

/**
 * A table, drawn.
 *
 * The layout decides the columns and fits the cells; what a rule looks like is
 * the theme's, so the box is the one part of a table that is painted rather
 * than measured. Which makes the thing worth checking here that the two halves
 * agree - the cells the layout padded line up under the rules the painter drew.
 */

const DOC = [
  '| File | Change | Lines |',
  '| --- | :---: | ---: |',
  '| markdown.ts | table layout | +180 |',
  '| view.ts | draws them | +42 |',
].join('\n');

const open = async (width: number, options: Record<string, unknown> = {}) => {
  const t = await renderApp({
    width, height: 12, root: h(MarkdownView, { content: DOC }), ...options,
  });
  await t.settle();
  await t.settle();
  return t;
};

/**
 * Where the rules are on a row.
 *
 * Box-drawing only, deliberately: the ASCII set draws them as `|` and `+`,
 * and `+180` is a cell in this table - a detector that took those would find
 * a column in the middle of a number.
 */
const joints = (line: string): number[] =>
  [...line].flatMap((c, i) => ('│┼┬┴├┤┌┐└┘'.includes(c) ? [i] : []));

describe('a markdown table', () => {
  it('boxes it, with a rule under the header', async () => {
    const t = await open(62);
    expect(t.line(0)).toMatch(/^┌[─┬]+┐$/);
    expect(t.line(1)).toContain('File');
    expect(t.line(2)).toMatch(/^├[─┼]+┤$/);
    expect(t.line(3)).toContain('markdown.ts');
    expect(t.line(5)).toMatch(/^└[─┴]+┘$/);
    await t.unmount();
  });

  it('puts every rule in the same column on every row', async () => {
    const t = await open(62);
    const edges = joints(t.line(0));
    expect(edges).toHaveLength(4);
    // Which is the whole point of the widths being decided once for the
    // table: a column measured per row is not a column.
    for (let y = 1; y <= 5; y++) expect(joints(t.line(y))).toEqual(edges);
    await t.unmount();
  });

  it('honours the alignment the divider asked for', async () => {
    const t = await open(62);
    const row = t.line(3);
    const bars = joints(row);
    // `---:` is right, so the number sits against the closing rule rather
    // than against the one before it.
    const last = row.slice((bars[2] as number) + 1, bars[3] as number);
    expect(last.startsWith(' ')).toBe(true);
    expect(last.trimEnd().endsWith('+180')).toBe(true);
    await t.unmount();
  });

  /**
   * `border: 'none'` is a theme saying "do not box things" - panels, fences,
   * dialogs. It is not saying "do not tell these columns apart": a table's
   * rules are its structure, and without them it is text that happens to line
   * up, with nothing to say where it ended.
   */
  it('rules a table even under a theme that draws no borders', async () => {
    const t = await open(62, { theme: 'paper' });
    expect(t.line(0)).toMatch(/^┌[─┬]+┐$/);
    expect(joints(t.line(1))).toHaveLength(4);
    await t.unmount();
  });

  it('draws it in ASCII where the console cannot do box characters', async () => {
    const t = await open(62, {
      theme: 'paper',
      capabilities: { unicode: 'ascii', wideChars: false },
    });
    expect(t.line(0)).toMatch(/^\+[-+]+\+$/);
    expect(t.line(1)).toContain('| File');
    // Nothing above 0x7f anywhere: this is the check a Windows console cares
    // about, and a table is the newest thing likely to fail it.
    expect([...t.text()].every((c) => (c.codePointAt(0) as number) <= 0x7f)).toBe(true);
    await t.unmount();
  });

  /**
   * A rule between every pair is right for a table of few, long rows and
   * noise on a table of twenty short ones - so it is the theme's call, and
   * the theme opts in rather than out.
   */
  it('rules between the rows when the theme opts in', async () => {
    const t = await open(62, {
      theme: 'lined',
      themes: [{ id: 'lined', name: 'Lined', extends: 'paper', tableRules: 'all' }],
    });
    // top, head, rule, body, rule, body, bottom.
    expect(t.line(2)).toMatch(/^├[─┼]+┤$/);
    expect(t.line(4)).toMatch(/^├[─┼]+┤$/);
    expect(t.line(6)).toMatch(/^└[─┴]+┘$/);
    // The rules line up with the columns, which is the half the painter owns.
    expect(joints(t.line(4))).toEqual(joints(t.line(0)));
    await t.unmount();
  });

  it('leaves a table alone under a theme that did not opt in', async () => {
    const t = await open(62, { theme: 'paper' });
    // Where the extra rule would have been.
    expect(t.line(4)).toContain('view.ts');
    await t.unmount();
  });

  it('stays six rows tall when the columns will not fit', async () => {
    const t = await open(30);
    // Four source lines and three edges - cut rather than wrapped. A viewer
    // that windows these scrolls by index, so a table that grew a line when
    // it was measured would put everything after it in the wrong place.
    expect(t.line(6).trim()).toBe('');
    expect(t.text()).toContain('…');
    expect(t.line(0).length).toBeLessThanOrEqual(30);
    await t.unmount();
  });
});
