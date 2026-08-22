import { describe, expect, it } from 'vitest';
import { packColor, downsample } from '@textui/core';
import type { ColorDepth } from '@textui/core';
import { tintOf } from '../src/components/editor.js';

/**
 * How faint a wash may be before the terminal cannot hold it.
 *
 * The rule used to be 24-bit or nothing, on the grounds that "mixing two of
 * the sixteen palette colours lands on a third that means something else".
 * True of sixteen. Two hundred and fifty-six is a different number, and it is
 * the one most terminals actually have - a `COLORTERM`-less `xterm-256color`
 * is the common case, so the feature was off for most people by an argument
 * about a palette they were not using.
 */

const CANVAS = '#1e1e1e';
const SUCCESS = '#3fb950';
const DANGER = '#f85149';
const WARNING = '#d29922';

describe('tintOf', () => {
  it('refuses sixteen colours, where the wash would land on a named colour', () => {
    expect(tintOf(CANVAS, SUCCESS, 4 as ColorDepth)).toBeUndefined();
    expect(tintOf(CANVAS, DANGER, 4 as ColorDepth)).toBeUndefined();
    expect(tintOf(CANVAS, WARNING, 1 as ColorDepth)).toBeUndefined();
  });

  it.each([
    ['added', SUCCESS],
    ['removed', DANGER],
    ['changed', WARNING],
  ])('washes %s at 256 colours', (_name, tone) => {
    const tint = tintOf(CANVAS, tone, 8 as ColorDepth);
    expect(tint, 'the 6x6x6 cube is fine enough for this').toBeDefined();
    // And it has to survive the quantisation, or it is a wash that draws the
    // canvas back onto the canvas - which is the case the function reports as
    // no wash at all.
    expect(downsample(packColor(tint), 8)).not.toBe(downsample(packColor(CANVAS), 8));
  });

  it.each([SUCCESS, DANGER, WARNING])('washes at 24-bit, as it always did', (tone) => {
    expect(tintOf(CANVAS, tone, 24 as ColorDepth)).toBeDefined();
  });

  it('says no wash when the tint quantises onto the canvas', () => {
    // A tone the canvas already is: 14% of the way from a colour to itself is
    // that colour, so there is nothing to draw and nothing is what is
    // reported - rather than a background the same shade as the background.
    expect(tintOf(CANVAS, CANVAS, 8 as ColorDepth)).toBeUndefined();
    expect(tintOf(CANVAS, CANVAS, 24 as ColorDepth)).toBeUndefined();
  });

  it('keeps the wash faint enough to read syntax through', () => {
    // 14% of the way, not half: the row already carries syntax colour and
    // possibly a selection, and the gutter mark is what *says* what happened.
    const tint = packColor(tintOf(CANVAS, SUCCESS, 24 as ColorDepth));
    const canvas = packColor(CANVAS);
    const tone = packColor(SUCCESS);
    const channel = (c: number, shift: number): number => (c >> shift) & 0xff;
    for (const shift of [16, 8, 0]) {
      const from = channel(canvas, shift);
      const to = channel(tone, shift);
      const got = channel(tint, shift);
      expect(Math.abs(got - from), 'closer to the canvas than to the tone')
        .toBeLessThan(Math.abs(to - from) / 2);
    }
  });
});
