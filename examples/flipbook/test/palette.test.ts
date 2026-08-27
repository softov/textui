import { describe, expect, it } from 'vitest';
import {
  atHue, fromHex, hueAt, hueIndex, hueRamp, L_MAX, L_MIN, S_FLOOR, stepHue, stepLight, toHex,
} from '../src/palette.js';
import type { Hex } from '../src/palette.js';

/**
 * The picker, as a keyboard drives it.
 *
 * Two questions, and the conversions are only the first. `toHex` and `fromHex`
 * are HSL and either agree with the definition or do not. What the keys *do*
 * is the second, and it is where this went wrong: the guards around the
 * conversions - a lightness that stops short of the ends, a saturation floor
 * under a hue step - were applied in three places that each worked them out
 * differently, so the swatch on screen, the colour a step gave and the colour
 * a click gave were three different colours.
 */

/** HSL to RGB again, from the CSS Color 3 definition, to check against. */
function css(h: number, s: number, l: number): string {
  const S = s / 100, L = l / 100;
  const f = (n: number): number => {
    const k = (n + h / 30) % 12;
    const a = S * Math.min(L, 1 - L);
    return L - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  const hx = (v: number): string => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${hx(f(0))}${hx(f(8))}${hx(f(4))}`;
}

const channel = (hex: string, at: number): number => parseInt(hex.slice(at, at + 2), 16);
const apart = (a: string, b: string): number => Math.max(
  Math.abs(channel(a, 1) - channel(b, 1)),
  Math.abs(channel(a, 3) - channel(b, 3)),
  Math.abs(channel(a, 5) - channel(b, 5)),
);

describe('the conversions are HSL', () => {
  it('agrees with the definition to within a rounding step', () => {
    let worst = 0;
    for (let h = 0; h < 360; h += 1) {
      for (let s = 0; s <= 100; s += 5) {
        for (let l = 0; l <= 100; l += 5) {
          worst = Math.max(worst, apart(toHex({ h, s, l }), css(h, s, l)));
        }
      }
    }
    // Two correct formulations of the same function, rounding differently in
    // the last place. Anything above one is arithmetic, not rounding.
    expect(worst).toBeLessThanOrEqual(1);
  });

  it('reads a grey back as a grey, with no hue invented', () => {
    for (const grey of ['#000000', '#7f7f7f', '#ffffff']) {
      expect(fromHex(grey).s).toBe(0);
    }
  });

  it('answers something usable for a string that is not a colour', () => {
    expect(fromHex('nonsense')).toEqual({ h: 0, s: 0, l: 50 });
  });
});

describe('stepping the lightness', () => {
  /*
   * The bug this is here for: the guard belongs on the step, not on the colour
   * handed in. Clamped regardless, `#ffffff` is `l: 100` and both keys pulled
   * it to 94 - so "lighter" darkened the default ink, and eight of each from
   * white arrived at mid-grey.
   */
  it('does nothing, rather than the opposite, at either end', () => {
    expect(stepLight('#ffffff', 5)).toBe('#ffffff');
    expect(stepLight('#000000', -5)).toBe('#000000');
  });

  it('moves off the end and back onto it', () => {
    const down = stepLight('#ffffff', -5);
    expect(down).not.toBe('#ffffff');
    expect(stepLight(down, 5)).toBe('#ffffff');
  });

  it('lets a grey reach both ends, having no hue to lose', () => {
    let c: Hex = '#7f7f7f';
    for (let i = 0; i < 40; i++) c = stepLight(c, 5);
    expect(c).toBe('#ffffff');
    for (let i = 0; i < 40; i++) c = stepLight(c, -5);
    expect(c).toBe('#000000');
  });

  it('holds a colour short of the ends, so its hue survives', () => {
    let c: Hex = '#c94f3d';
    for (let i = 0; i < 40; i++) c = stepLight(c, 5);
    expect(fromHex(c).l).toBe(L_MAX);
    // Which is the whole point of stopping short: there is still a colour here.
    expect(fromHex(c).s).toBeGreaterThan(0);
    for (let i = 0; i < 40; i++) c = stepLight(c, -5);
    expect(fromHex(c).l).toBe(L_MIN);
    expect(fromHex(c).s).toBeGreaterThan(0);
  });
});

describe('stepping the hue', () => {
  it('comes back round the circle', () => {
    // One press to get onto the grid - a document's colours do not start on
    // it - and the twenty-four after that are a full turn.
    const start = stepHue('#c94f3d', 15);
    let c: Hex = start;
    for (let i = 0; i < 24; i++) c = stepHue(c, 15);
    expect(c).toBe(start);
  });

  it('lifts a grey to a saturation that can show a hue', () => {
    expect(fromHex(stepHue('#8c916e', 15)).s).toBe(S_FLOOR);
    // Read back through eight-bit channels rather than exactly: at `L_MAX`
    // the chroma of `S_FLOOR` is a couple of counts wide, so a round trip
    // lands a point either side of it. Near enough is the claim; the claim
    // that matters is that there is a colour here at all.
    expect(fromHex(stepHue('#ffffff', 15)).s).toBeCloseTo(S_FLOOR, -0.5);
    expect(fromHex(stepHue('#ffffff', 15)).s).toBeGreaterThan(0);
  });

  it('walks the cells of the ramp, not the degrees between them', () => {
    // The sample's ground is hue 69, which is not on the fifteen-degree grid.
    let c: Hex = '#8c916e';
    const walked: number[] = [];
    for (let i = 0; i < 4; i++) { c = stepHue(c, 15); walked.push(fromHex(c).h); }
    expect(walked).toEqual([75, 90, 105, 120]);
  });

  it('turns round on the near side, going the other way', () => {
    let c: Hex = '#8c916e';
    c = stepHue(c, -15);
    expect(fromHex(c).h).toBe(60);
    c = stepHue(c, -15);
    expect(fromHex(c).h).toBe(45);
  });

  it('brings a colour at either end of lightness back where a hue shows', () => {
    expect(fromHex(stepHue('#ffffff', 15)).l).toBe(L_MAX);
    expect(fromHex(stepHue('#000000', 15)).l).toBe(L_MIN);
  });
});

describe('the ramp and what it promises', () => {
  const STEPS = 24;

  it('marks the cell the ink is actually in', () => {
    // Which is what stepping onto the grid buys: the marker sits under the
    // colour the ink is, rather than under the nearest cell to a hue that
    // fell between two of them.
    for (const ink of ['#8c916e', '#c94f3d', '#3d7fc9', '#ffffff', '#000000'] as const) {
      const stepped = stepHue(ink, 15);
      const ramp = hueRamp(fromHex(stepped), STEPS);
      const marked = ramp[hueIndex(fromHex(stepped), STEPS)] as string;
      // To a rounding step: `hueRamp` reads the ink back out of eight-bit
      // channels to draw itself, and integer HSL does not survive that
      // exactly. Two counts is invisible; a wrong cell is fifteen degrees.
      expect(apart(marked, stepped)).toBeLessThanOrEqual(2);
    }
  });

  it('shows the colour that clicking it gives', () => {
    const current = fromHex('#8c916e');
    const ramp = hueRamp(current, STEPS);
    for (let i = 0; i < STEPS; i++) {
      expect(atHue(current, hueAt(i, STEPS))).toBe(ramp[i]);
    }
  });

  it('is a row of different colours even when the ink is white', () => {
    // Drawn at the ink's own lightness it was twenty-four white cells: a hue
    // cannot show at `l: 100`, whatever it is set to.
    const ramp = hueRamp(fromHex('#ffffff'), STEPS);
    expect(new Set(ramp).size).toBeGreaterThan(STEPS / 2);
  });

  it('marks the first cell for a hue just short of the full circle', () => {
    // Hue is a circle: 359 degrees is one degree from the first cell and
    // fifteen from the last, so clamping to the last one marked the wrong end.
    expect(hueIndex({ h: 359, s: 50, l: 50 }, STEPS)).toBe(0);
    expect(hueIndex({ h: 0, s: 50, l: 50 }, STEPS)).toBe(0);
    expect(hueIndex({ h: 180, s: 50, l: 50 }, STEPS)).toBe(STEPS / 2);
  });

  it('stays inside the row for every hue there is', () => {
    for (let h = 0; h < 360; h++) {
      const i = hueIndex({ h, s: 50, l: 50 }, STEPS);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(STEPS);
    }
  });
});
