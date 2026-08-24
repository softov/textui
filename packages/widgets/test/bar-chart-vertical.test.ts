import { describe, expect, it } from 'vitest';
import { h, renderToString } from '@textui/core';
import { BarChart } from '../src/chart/index.js';
import { CATALOG } from '../src/index.js';

/*
 * Standing up, a bar was one cell across and its label one letter, and neither
 * could be asked for otherwise - the height was hardcoded too, so `barWidth`
 * did nothing at all in this orientation.
 */
describe('a vertical bar chart', () => {
  const data = [
    { label: '2xx', value: 8421, tone: 'success' as const },
    { label: '3xx', value: 1180, tone: 'info' as const },
    { label: '4xx', value: 412, tone: 'warning' as const },
  ];

  const draw = (props: Record<string, unknown>, width = 30): string[] =>
    renderToString(h(BarChart, { data, orientation: 'vertical', ...props }), { width, components: CATALOG })
      .split('\n').map((line) => line.trimEnd());

  it('is one cell across by default, as it always was', () => {
    const rows = draw({});
    expect(rows[0]).toBe('█');
    // An initial, because that is all a one-cell column has room for.
    expect(rows[rows.length - 1]).toBe('2 3 4');
  });

  // Two widths, because the label has to follow the bar rather than the
  // terminal - a wider chart does not get more letters, a wider *bar* does.
  for (const width of [30, 60]) {
    it(`gives two cells and two letters at columnWidth 2, at ${width} columns`, () => {
      const rows = draw({ columnWidth: 2 }, width);
      expect(rows[0]).toBe('██');
      expect(rows[rows.length - 1]).toBe('2x 3x 4x');
    });
  }

  it('grows the label to the bar, up to the whole label', () => {
    const rows = draw({ columnWidth: 3 });
    expect(rows[0]).toBe('███');
    expect(rows[rows.length - 1]).toBe('2xx 3xx 4xx');
  });

  it('pads a short label so the next one stays over its own bar', () => {
    // Without the pad, a one-letter name lets everything after it slide left.
    const rows = draw({ data: [{ label: 'a', value: 5 }, { label: 'bbb', value: 5 }], columnWidth: 3 });
    expect(rows[rows.length - 1]).toBe('a   bbb');
  });

  it('takes a height, which used to be fixed at eight', () => {
    // Rows of chart plus the label row.
    expect(draw({ chartHeight: 4 })).toHaveLength(5);
    expect(draw({ chartHeight: 8 })).toHaveLength(9);
  });

  it('leaves the horizontal orientation alone', () => {
    const rows = renderToString(h(BarChart, { data, barWidth: 10 }), { width: 30, components: CATALOG })
      .split('\n').map((line) => line.trimEnd()).filter((line) => line !== '');
    expect(rows[0]).toContain('2xx');
    expect(rows).toHaveLength(3);
  });
});
