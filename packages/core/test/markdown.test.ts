import { describe, expect, it } from 'vitest';
import { inlineRuns, layoutMarkdown, runsToText, wrapRuns } from '../src/util/markdown.js';
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
