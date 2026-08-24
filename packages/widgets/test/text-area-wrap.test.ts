import { describe, expect, it } from 'vitest';
import { h, renderToString } from '@textui/core';
import { TextArea } from '../src/control/index.js';
import { CATALOG } from '../src/index.js';

/*
 * Every row was drawn with `truncate: 'end'`, so a line wider than the field
 * was shown as its first few words and an ellipsis - text that had been typed
 * and could not be read back. `TextArea` is the field the docs call "the one
 * that is a paragraph", and a paragraph wraps.
 */
describe('a TextArea wraps what does not fit', () => {
  const SENTENCE = 'the quick brown fox jumps over the lazy dog and keeps running';

  const rowsOf = (value: string, extra: Record<string, unknown>, width: number): string[] =>
    renderToString(h(TextArea, { value, onChange: () => undefined, ...extra }), { width, components: CATALOG })
      .split('\n')
      .map((line) => line.replace(/[│┌┐└┘─]/g, '').trimEnd())
      .filter((line) => line !== '');

  // Two widths, because one width is the same as none: the whole feature is a
  // function of how much room the layout gave the field.
  for (const width of [30, 48]) {
    it(`keeps every word at ${width} columns`, () => {
      const rows = rowsOf(SENTENCE, { border: 'single' }, width);

      expect(rows.length).toBeGreaterThan(1);
      expect(rows.join(' ')).not.toContain('…');
      // Not just "the words are somewhere": in order, and nothing invented.
      expect(rows.join(' ').split(/\s+/)).toEqual(SENTENCE.split(' '));
      for (const row of rows) expect(row.length).toBeLessThanOrEqual(width - 2);
    });
  }

  it('breaks a word that is longer than the field, having nowhere else to break', () => {
    const rows = rowsOf('x'.repeat(50), { border: 'single' }, 30);
    expect(rows.length).toBeGreaterThan(1);
    expect(rows.join('')).toBe('x'.repeat(50));
  });

  it('counts maxRows in rows, not in lines', () => {
    // One logical line, three rows of it. `maxRows` is a budget of screen, so
    // counting lines would let a single wrapped line fill the pane.
    const all = rowsOf(SENTENCE, { border: 'single' }, 30);
    expect(all.length).toBe(3);
    expect(rowsOf(SENTENCE, { border: 'single', maxRows: 2 }, 30)).toHaveLength(2);
  });

  it('still truncates when the caller asks for one row per line', () => {
    // The escape hatch, and the old behaviour: `wrap` is inherited from
    // `BoxProps`, so any of its truncating values gets it back.
    const rows = rowsOf(SENTENCE, { border: 'single', wrap: 'none' }, 30);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain('…');
  });

  it('leaves a hard newline hard', () => {
    // Wrapping adds rows; it must not merge the ones that were already there.
    expect(rowsOf('a\nb\nc', { border: 'single' }, 30)).toEqual(['a', 'b', 'c']);
  });
});
