import { describe, expect, it } from 'vitest';
import { h, renderToString } from '@textui/core';
import { Column, Gauge, Progress } from '../src/index.js';
import { CATALOG } from '../src/index.js';

/*
 * `spacer` puts a stretchy gap where the fixed one is, so the label stays left
 * and the track ends hard against the right. The mirror of `labelWidth`, which
 * pads the label so the bars *start* at one column; this makes them end at one,
 * and it needs no number - which matters because the number that would be right
 * depends on the longest label, and nothing here can see its siblings.
 */
describe('a meter that pushes its bar to the right', () => {
  const rows = (spacer: boolean, width: number): string[] =>
    renderToString(
      h(Column, { width },
        h(Progress, { value: 72, total: 100, label: 'up', spacer }),
        h(Progress, { value: 31, total: 100, label: 'a much longer label', spacer }),
        h(Gauge, { value: 86, label: 'disk', spacer }),
      ),
      { width, components: CATALOG },
    ).split('\n').map((line) => line.trimEnd()).filter((line) => line !== '');

  // Two widths, because "hard against the right" is a claim about a width.
  for (const width of [44, 60]) {
    it(`ends every bar at the same column at ${width}`, () => {
      const ends = rows(true, width).map((line) => line.length);
      expect(new Set(ends).size).toBe(1);
      expect(ends[0]).toBe(width);
    });

    it(`leaves them ragged without it at ${width}`, () => {
      // The default, and why the prop exists: three labels of different
      // lengths put their tracks in three places.
      const starts = rows(false, width).map((line) => line.indexOf('█'));
      expect(new Set(starts).size).toBeGreaterThan(1);
    });
  }

  it('keeps the label at the left, not pushed along with the bar', () => {
    const [first] = rows(true, 44);
    expect(first?.startsWith('up ')).toBe(true);
  });

  it('does nothing in a row only as wide as its contents', () => {
    // `x` + gap + a 20-cell bar + gap + `50%` is exactly 26, so there is
    // nothing left over to stretch into. The honest answer is the same row -
    // a component does not get to widen its parent to make room for a gap.
    const tight = (spacer: boolean): string =>
      renderToString(
        h(Progress, { value: 50, total: 100, label: 'x', spacer }),
        { width: 26, components: CATALOG },
      ).split('\n')[0]?.trimEnd() ?? '';
    expect(tight(true)).toBe(tight(false));
    expect(tight(true)).toContain('50%');
  });
});
