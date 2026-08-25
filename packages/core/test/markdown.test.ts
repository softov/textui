import { describe, expect, it } from 'vitest';
import { inlineRuns, layoutMarkdown, runsToText, wrapRuns } from '../src/util/markdown.js';
import { stringWidth } from '../src/util/text.js';
import type { MarkdownRow } from '../src/types/markdown.js';

/**
 * The rows, checked as values.
 *
 * The invariant everything else depends on is that **every row is exactly one
 * row tall**: a viewer counts them to know how far it can scroll, and counting
 * source lines instead is what makes the tail of a long document unreachable.
 */

const text = (rows: MarkdownRow[]): string[] =>
  rows.filter((row) => row.kind === 'text' || row.kind === 'heading')
    .map((row) => (row.kind === 'text' || row.kind === 'heading' ? runsToText(row.runs) : ''));

describe('inline', () => {
  it('keeps emphasis, code and links as runs', () => {
    const runs = inlineRuns('the **composer** owns `enter`, see [docs](./keys.md)');
    expect(runs.find((run) => run.bold)?.text).toBe('composer');
    expect(runs.find((run) => run.code)?.text).toBe('enter');
    expect(runs.find((run) => run.link)).toMatchObject({ text: 'docs', link: './keys.md' });
  });

  it('leaves an unmatched marker literal', () => {
    // A closing marker that has not arrived yet is not a reason to reformat
    // what is already on screen.
    expect(runsToText(inlineRuns('2 * 3 and **half a bold'))).toBe('2 * 3 and **half a bold');
  });
});

describe('wrapping runs', () => {
  it('wraps on cells and keeps the style across the break', () => {
    const lines = wrapRuns(inlineRuns('one two **three four** five'), 10);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.flat().filter((run) => run.bold).map((run) => run.text).join(' ')).toContain('three');
  });

  it('breaks a word longer than the line rather than widening the pane', () => {
    const lines = wrapRuns([{ text: '/a/very/long/path/that/never/fits/anywhere' }], 10);
    expect(lines.every((line) => runsToText(line).length <= 10)).toBe(true);
  });

  it('counts wide characters as two cells', () => {
    const lines = wrapRuns([{ text: '日本語 日本語 日本語' }], 8);
    expect(lines.length).toBeGreaterThan(1);
  });

  it('never starts a line with a space nobody typed', () => {
    const lines = wrapRuns(inlineRuns('alpha beta gamma delta'), 11);
    expect(lines.every((line) => !runsToText(line).startsWith(' '))).toBe(true);
  });
});

describe('layout', () => {
  it('wraps a paragraph into one row each', () => {
    const rows = layoutMarkdown('one two three four five six seven', { width: 12 });
    expect(rows.every((row) => row.kind === 'text')).toBe(true);
    expect(rows.length).toBeGreaterThan(2);
  });

  it('marks a list with the glyph it was given, and indents the wrap', () => {
    const rows = layoutMarkdown('- a list item that is long enough to wrap once', {
      width: 20, bullet: '*',
    });
    const first = rows[0] as Extract<MarkdownRow, { kind: 'text' }>;
    const second = rows[1] as Extract<MarkdownRow, { kind: 'text' }>;
    expect(first.prefix).toBe('*');
    // The marker on the first row, its width on the rest - or the second line
    // of an item reads as a new paragraph.
    expect(second.prefix).toBe(' ');
  });

  it('repeats the quote bar down every row of the quote', () => {
    const rows = layoutMarkdown('> a quotation long enough to take two rows of this width', {
      width: 24, quoteBar: '|',
    });
    expect(rows.every((row) => row.kind === 'text' && row.prefix === '|')).toBe(true);
  });

  it('lays out a fence as its own rows, tagged with which fence they are', () => {
    const rows = layoutMarkdown('before\n```sh\nmake\nmake install\n```\nafter', { width: 40 });
    const fences = rows.filter((row) => row.kind === 'fence');
    expect(fences.map((row) => (row.kind === 'fence' ? row.part : ''))).toEqual(['open', 'code', 'code', 'close']);
    expect(fences.every((row) => row.kind === 'fence' && row.fence === 0)).toBe(true);
  });

  it('closes a fence that was never closed', () => {
    // A streamed turn may simply not have said the closing marker yet.
    const rows = layoutMarkdown('```\nmake', { width: 40 });
    expect(rows.filter((row) => row.kind === 'fence').map((r) => (r.kind === 'fence' ? r.part : '')))
      .toEqual(['open', 'code', 'close']);
  });

  it('draws no fence rules for a borderless theme', () => {
    // A layout that reserved two rows for rules nobody draws stops two rows
    // short of the end of the document.
    const rows = layoutMarkdown('```\nmake\n```', { width: 40, ruled: false });
    expect(rows.filter((row) => row.kind === 'fence').every((r) => r.kind === 'fence' && r.part === 'code')).toBe(true);
  });

  it('keeps a blank line as a row, so paragraphs stay apart', () => {
    const rows = layoutMarkdown('one\n\ntwo', { width: 20 });
    expect(text(rows)).toEqual(['one', '', 'two']);
  });

  it('wraps a heading and keeps its level', () => {
    const rows = layoutMarkdown('### a heading long enough to wrap at this width', { width: 20 });
    expect(rows.every((row) => row.kind === 'heading' && row.level === 3)).toBe(true);
  });

  it('does not wrap at all before anything has been measured', () => {
    // Width zero is "not laid out yet". Guessing a width and re-wrapping on
    // the next frame is what makes a streaming message jump.
    const rows = layoutMarkdown('a line that would certainly wrap somewhere', { width: 0 });
    expect(rows).toHaveLength(1);
  });
});

/**
 * Tables.
 *
 * The hard part is not the pipes, it is staying one row per row. A cell wider
 * than its column is cut rather than wrapped, because a document's length has
 * to be a count of rows - a viewer that windows this scrolls by index, and a
 * table that grew a line when it was measured would put every row after it in
 * the wrong place.
 */
describe('layoutMarkdown, on tables', () => {
  const TABLE = [
    '| File | Change | Lines |',
    '| --- | :---: | ---: |',
    '| markdown.ts | table layout | +180 |',
    '| view.ts | draws them | +42 |',
  ].join('\n');

  const tables = (rows: MarkdownRow[]): Extract<MarkdownRow, { kind: 'table' }>[] =>
    rows.filter((row): row is Extract<MarkdownRow, { kind: 'table' }> => row.kind === 'table');

  it('makes one row per source line, plus the box and the rule', () => {
    const rows = layoutMarkdown(TABLE, { width: 60 });
    // Four source lines and three edges. The edges are rows here for the same
    // reason a fence's rules are: they take a line on the screen, so anything
    // counting rows has to be able to count them.
    expect(rows).toHaveLength(6);
    expect(tables(rows).map((row) => row.part))
      .toEqual(['top', 'head', 'rule', 'body', 'body', 'bottom']);
  });

  it('gives every row of a table the same columns', () => {
    const rows = tables(layoutMarkdown(TABLE, { width: 60 }));
    const widths = rows[0]?.widths;
    // A column measured per row is not a column.
    for (const row of rows) expect(row.widths).toEqual(widths);
  });

  it('reads the alignment off the divider', () => {
    const rows = tables(layoutMarkdown(TABLE, { width: 60 }));
    expect(rows[0]?.align).toEqual(['left', 'center', 'right']);


    // Which is padding, so it is visible in the cells themselves.
    const body = rows.find((row) => row.part === 'body');
    const right = runsToText(body?.cells[2] ?? []);
    expect(right.startsWith(' ')).toBe(true);
    expect(right.endsWith(' ')).toBe(false);
  });

  it('fits every cell to its column exactly', () => {
    const rows = tables(layoutMarkdown(TABLE, { width: 60 }));
    for (const row of rows) {
      if (row.part !== 'head' && row.part !== 'body') continue;
      row.cells.forEach((cell, i) => {
        expect(stringWidth(runsToText(cell))).toBe(row.widths[i]);
      });
    }
  });

  it('emphasises the header, so it reads as one', () => {
    const rows = tables(layoutMarkdown(TABLE, { width: 60 }));
    const head = rows.find((row) => row.part === 'head');
    expect(head?.cells.flat().some((run) => run.bold && run.text.includes('File'))).toBe(true);
  });

  it('cuts rather than wraps when the columns will not fit', () => {
    const rows = layoutMarkdown(TABLE, { width: 30 });
    // Still six rows. This is the whole invariant.
    expect(rows).toHaveLength(6);
    const widths = tables(rows)[0]?.widths ?? [];
    // Columns, a rule between each pair, and the box around the lot, inside
    // the width it was given.
    const used = widths.reduce((sum, w) => sum + w, 0) + (widths.length - 1) * 3 + 4;
    expect(used).toBeLessThanOrEqual(30);
    expect(tables(rows).some((row) => runsToText(row.cells.flat()).includes('\u2026'))).toBe(true);
  });

  it('leaves a row of pipes alone when nothing says it is a table', () => {
    // `a | b` is arithmetic or a shell pipeline far more often than it is a
    // one-row table, and the divider is what tells them apart.
    const rows = layoutMarkdown('cat file | grep x | wc -l', { width: 60 });
    expect(rows.every((row) => row.kind === 'text')).toBe(true);
  });

  it('takes a table with no outer pipes, which is what people write', () => {
    const rows = layoutMarkdown('a | b\n--- | ---\n1 | 2', { width: 40 });
    expect(tables(rows)).toHaveLength(5);
    expect(tables(rows).find((row) => row.part === 'head')?.cells).toHaveLength(2);
  });

  it('keeps an escaped bar inside its cell', () => {
    const rows = tables(layoutMarkdown('a | b\n---|---\nx \\| y | z', { width: 40 }));
    const body = rows.find((row) => row.part === 'body');
    expect(runsToText(body?.cells[0] ?? []).trim()).toBe('x | y');
    expect(body?.cells).toHaveLength(2);
  });

  /**
   * A rule between every pair of rows, when the theme asks for one.
   *
   * Which it has to ask the *layout* for, not the painter: a rule between two
   * rows is a row - it takes a line on the screen. Added at paint time it
   * would be a line the layout never counted, and every viewer that scrolls
   * by row index would be off by one per table row.
   */
  it('rules between the rows when the theme asks, and counts them', () => {
    const plain = layoutMarkdown(TABLE, { width: 60 });
    const lined = layoutMarkdown(TABLE, { width: 60, tableRules: 'all' });

    expect(tables(plain).map((row) => row.part))
      .toEqual(['top', 'head', 'rule', 'body', 'body', 'bottom']);
    // One more rule, for the one gap between two body rows - and it is a row
    // in the list, which is the point.
    expect(tables(lined).map((row) => row.part))
      .toEqual(['top', 'head', 'rule', 'body', 'rule', 'body', 'bottom']);
    expect(lined).toHaveLength(plain.length + 1);
  });

  it('does not rule after the last row, which the box already closes', () => {
    const rows = tables(layoutMarkdown(TABLE, { width: 60, tableRules: 'all' }));
    // A rule under the last row and then the bottom edge is two lines saying
    // the same thing.
    expect(rows[rows.length - 1]?.part).toBe('bottom');
    expect(rows[rows.length - 2]?.part).toBe('body');
  });

  it('rules nothing extra on a table of one row', () => {
    const one = ['| a | b |', '| --- | --- |', '| 1 | 2 |'].join('\n');
    expect(layoutMarkdown(one, { width: 40, tableRules: 'all' }))
      .toHaveLength(layoutMarkdown(one, { width: 40 }).length);
  });

  it('does not read a table inside a fence', () => {
    const rows = layoutMarkdown(['```', '| a | b |', '| --- | --- |', '```'].join('\n'), { width: 40 });
    expect(rows.every((row) => row.kind === 'fence')).toBe(true);
  });
});
