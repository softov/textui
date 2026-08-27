/**
 * Colour picking for a keyboard.
 *
 * A mouse picker is a two-dimensional field you point at. A keyboard one is
 * three numbers you step, so hue, saturation and lightness are the model here
 * rather than RGB - stepping red by eight is not a colour operation anyone
 * means, and stepping hue by eight is exactly what "a bit more orange" is.
 */

/** A 24-bit colour literal, which is what `Color` accepts. */
export type Hex = `#${string}`;

export interface Hsl {
  /** Degrees, 0-359. */
  h: number;
  /** Per cent, 0-100. */
  s: number;
  /** Per cent, 0-100. */
  l: number;
}

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
const hex2 = (v: number): string => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0');

export function toHex({ h, s, l }: Hsl): Hex {
  const sn = s / 100, ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r, g, b] =
    hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] :
    hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
  const m = ln - c / 2;
  return `#${hex2((r + m) * 255)}${hex2((g + m) * 255)}${hex2((b + m) * 255)}`;
}

export function fromHex(hex: string): Hsl {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m?.[1]) return { h: 0, s: 0, l: 50 };
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2;
  if (d === 0) return { h: 0, s: 0, l: Math.round(l * 100) };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h =
    max === r ? 60 * (((g - b) / d) % 6) :
    max === g ? 60 * ((b - r) / d + 2) :
                60 * ((r - g) / d + 4);
  return { h: Math.round(((h % 360) + 360) % 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}


export const wrapHue = (h: number, by: number): number => (((h + by) % 360) + 360) % 360;

/**
 * Lightness stops short of the ends of its range - for a colour.
 *
 * Pure white and pure black have no hue and no saturation - there is nothing
 * in `#ffffff` that says which colour it used to be. Reading one back gives
 * `{h: 0, s: 0}`, so a picker that round-trips through hex loses the colour
 * the moment lightness is walked to either end, and no amount of pressing the
 * hue key afterwards brings it back. Stopping short leaves the hex carrying
 * every number that was put into it.
 *
 * None of which applies to a grey, which has no hue to lose. Holding one
 * short of the ends only means white and black cannot be picked at all - and
 * white on a dark ground is most of what this draws.
 */
export const L_MIN = 6;
export const L_MAX = 94;

/**
 * Saturation a hue step lifts to, when there is none.
 *
 * Hue is meaningless on a grey, so on a document whose palette is near-grey -
 * which is most of them - pressing the hue key appears to do nothing at all.
 * Asking for a hue is asking for a colour, so the step supplies enough
 * saturation to show one.
 */
export const S_FLOOR = 32;

/** The hue cell `i` of a `steps`-wide ramp stands for. */
export const hueAt = (i: number, steps: number): number => Math.round((i / steps) * 360);

/**
 * The colour a hue lands on, from where the ink is now.
 *
 * One rule, because there are three ways to reach a hue - stepping onto it,
 * clicking its cell, and the cell being drawn - and each of them used to work
 * it out for itself. They disagreed: the ramp was drawn at a saturation floor
 * of 35 while a step lifted to `S_FLOOR`, and a click kept the ink's own
 * saturation and lifted nothing at all. So the swatch under the cursor was not
 * the ink a step gave you, and clicking a vivid-looking cell on a near-grey
 * ink painted in near-grey.
 */
export function atHue(current: Hsl, h: number): Hex {
  return toHex({
    h: wrapHue(h, 0),
    s: Math.max(current.s, S_FLOOR),
    // A hue cannot show at either end of lightness, so a ramp drawn at the
    // ink's own `l` is 24 identical white cells while the ink is white.
    l: clamp(current.l, L_MIN, L_MAX),
  });
}

/** A row of hues at the current saturation and lightness, for the slider. */
export function hueRamp(current: Hsl, steps: number): Hex[] {
  const out: Hex[] = [];
  for (let i = 0; i < steps; i++) out.push(atHue(current, hueAt(i, steps)));
  return out;
}

/**
 * Which cell of a `steps`-wide ramp the current hue sits in.
 *
 * Modulo rather than clamp: hue is a circle, and the last cell is not the
 * nearest one to 359 degrees - the first is, one degree away.
 */
export const hueIndex = (current: Hsl, steps: number): number =>
  Math.round((current.h / 360) * steps) % steps;

/**
 * Step the hue to the next one the ramp has a cell for.
 *
 * To the next grid line, not `by` degrees further on. The ramp is a row of
 * cells `by` degrees apart with a marker under the one the ink is nearest,
 * and a document's colours do not start on that grid: the sample's ground
 * reads as hue 69, so adding fifteen landed on 84 - between two cells, with
 * the marker pointing at one whose colour was not the ink. Walking the grid
 * means every hue the key can reach is a hue the ramp is showing.
 */
export function stepHue(hex: Hex, by: number): Hex {
  const hsl = fromHex(hex);
  const size = Math.abs(by);
  if (size === 0) return atHue(hsl, hsl.h);
  // The next line *in the direction of travel*, so a hue already on the grid
  // moves a whole cell and one between them moves to the near side first.
  const next = by > 0
    ? Math.floor(hsl.h / size) * size + size
    : Math.ceil(hsl.h / size) * size - size;
  return atHue(hsl, wrapHue(next, 0));
}

/**
 * Step the lightness, stopping short of the ends that erase the colour.
 *
 * The guard is on the *step*, not on the colour handed in. Clamping the
 * result regardless is what made both keys do the same thing at the ends:
 * `#ffffff` is `l: 100`, so "lighter" clamped it to 94 and darkened it, and
 * "darker" clamped to 94 as well - eight of each, starting from the default
 * ink, arrived at mid-grey. A step that would leave the range does nothing
 * instead, so the key that cannot move the colour is simply the key that does
 * not move it.
 */
export function stepLight(hex: Hex, by: number): Hex {
  const hsl = fromHex(hex);
  const [lo, hi] = hsl.s === 0 ? [0, 100] : [L_MIN, L_MAX];
  if (by > 0 && hsl.l >= hi) return hex;
  if (by < 0 && hsl.l <= lo) return hex;
  return toHex({ ...hsl, l: clamp(hsl.l + by, lo, hi) });
}
