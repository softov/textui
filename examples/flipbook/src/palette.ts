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

/** A row of hues at the current saturation and lightness, for the slider. */
export function hueRamp(current: Hsl, steps: number): Hex[] {
  const out: Hex[] = [];
  for (let i = 0; i < steps; i++) {
    out.push(toHex({ h: Math.round((i / steps) * 360), s: Math.max(35, current.s), l: current.l }));
  }
  return out;
}

/** Which cell of a `steps`-wide ramp the current hue sits in. */
export const hueIndex = (current: Hsl, steps: number): number =>
  clamp(Math.round((current.h / 360) * steps), 0, steps - 1);

export const wrapHue = (h: number, by: number): number => (((h + by) % 360) + 360) % 360;

/**
 * Lightness never reaches the ends of its range.
 *
 * Pure white and pure black have no hue and no saturation - there is nothing
 * in `#ffffff` that says which colour it used to be. Reading one back gives
 * `{h: 0, s: 0}`, so a picker that round-trips through hex loses the colour
 * the moment lightness is walked to either end, and no amount of pressing the
 * hue key afterwards brings it back. Stopping short leaves the hex carrying
 * every number that was put into it.
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

/** Step the hue, and make sure the result can show one. */
export function stepHue(hex: Hex, by: number): Hex {
  const hsl = fromHex(hex);
  return toHex({
    h: wrapHue(hsl.h, by),
    s: Math.max(hsl.s, S_FLOOR),
    l: clamp(hsl.l, L_MIN, L_MAX),
  });
}

/** Step the lightness, stopping short of the ends that erase the colour. */
export function stepLight(hex: Hex, by: number): Hex {
  const hsl = fromHex(hex);
  return toHex({ ...hsl, l: clamp(hsl.l + by, L_MIN, L_MAX) });
}
