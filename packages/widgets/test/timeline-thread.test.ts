import { describe, expect, it } from 'vitest';
import { h, renderToString } from '@textui/core';
import { Timeline } from '../src/display/index.js';
import { CATALOG } from '../src/index.js';

/*
 * The connector was a single `text`, one cell tall, so an entry whose
 * description wrapped got one cell of line under its bullet and then a gap.
 * The thread that makes a timeline a timeline broke at every long entry - and
 * the narrower the column, the more of them there were.
 */
describe('the thread down a timeline', () => {
  const items = [
    { time: '09:12', title: 'Build passed', tone: 'success' as const },
    { time: '09:14', title: 'Canary', description: 'the error rate stayed flat for the whole ten minutes' },
    { time: '09:30', title: 'Spike', description: 'p99 1.4s', tone: 'warning' as const },
  ];

  const rows = (width: number): string[] =>
    renderToString(h(Timeline, { items }), { width, components: CATALOG })
      .split('\n').map((line) => line.trimEnd()).filter((line) => line !== '');

  // Two widths, and the narrow one is the point: it wraps more, so it has more
  // rows that used to be missing their line.
  for (const width of [40, 26]) {
    it(`runs unbroken from the first bullet to the last at ${width}`, () => {
      const gutter = rows(width).map((line) => line.charAt(0));
      const last = gutter.lastIndexOf('●');
      // Every row above the final bullet carries either a bullet or the line.
      for (const [i, cell] of gutter.slice(0, last).entries()) {
        expect(cell, `row ${i} of the gutter`).toMatch(/[●│]/);
      }
    });
  }

  it('spans every row of an entry that wrapped', () => {
    const lines = rows(26);
    const start = lines.findIndex((line) => line.includes('Canary'));
    const end = lines.findIndex((line) => line.includes('Spike'));
    // The description took more than one row, and each of them has the line.
    expect(end - start).toBeGreaterThan(2);
    for (const line of lines.slice(start + 1, end)) expect(line.charAt(0)).toBe('│');
  });

  it('still gives a one-row entry its own connector', () => {
    // Two short entries used to be separated by a row of line, and a purely
    // elastic connector would have given them nothing - a one-row entry has no
    // room left over to fill.
    const lines = rows(40);
    expect(lines[0]).toContain('Build passed');
    expect(lines[1]?.trim()).toBe('│');
  });

  it('stops at the last entry', () => {
    const lines = rows(40);
    expect(lines[lines.length - 1]).toContain('p99 1.4s');
    expect(lines[lines.length - 1]?.charAt(0)).not.toBe('│');
  });
});
