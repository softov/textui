import type { AnsiColorName, Color, ColorDepth } from '../types/index.js';

/**
 * Colours are packed into one integer so a cell is cheap to store and cheap to
 * compare - the frame diff runs over every cell, every frame.
 *
 *   -1              terminal default
 *   0..255          palette index (0..15 are the ANSI names)
 *   >= 0x1000000    24-bit rgb, as 0x1000000 | rrggbb
 */
export type PackedColor = number;

export const COLOR_DEFAULT: PackedColor = -1;
const RGB_FLAG = 0x1000000;

export const ANSI_NAMES: Record<AnsiColorName, number> = {
  black: 0, red: 1, green: 2, yellow: 3,
  blue: 4, magenta: 5, cyan: 6, white: 7,
  brightBlack: 8, brightRed: 9, brightGreen: 10, brightYellow: 11,
  brightBlue: 12, brightMagenta: 13, brightCyan: 14, brightWhite: 15,
};

export function packRgb(r: number, g: number, b: number): PackedColor {
  return RGB_FLAG | ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
}

export function isRgb(c: PackedColor): boolean {
  return c >= RGB_FLAG;
}

export function unpackRgb(c: PackedColor): [number, number, number] {
  return [(c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff];
}

export function packColor(color: Color | undefined): PackedColor {
  if (color === undefined || color === 'default') return COLOR_DEFAULT;
  if (typeof color === 'string') {
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      if (hex.length === 3) {
        const r = parseInt(hex[0] as string, 16);
        const g = parseInt(hex[1] as string, 16);
        const b = parseInt(hex[2] as string, 16);
        return packRgb(r * 17, g * 17, b * 17);
      }
      if (hex.length === 6) {
        return packRgb(
          parseInt(hex.slice(0, 2), 16),
          parseInt(hex.slice(2, 4), 16),
          parseInt(hex.slice(4, 6), 16),
        );
      }
      return COLOR_DEFAULT;
    }
    const idx = ANSI_NAMES[color as AnsiColorName];
    return idx === undefined ? COLOR_DEFAULT : idx;
  }
  if ('rgb' in color) {
    const [r, g, b] = color.rgb;
    return packRgb(r, g, b);
  }
  if ('palette' in color) return color.palette & 0xff;
  return COLOR_DEFAULT;
}

/** The xterm 256 palette, so 24-bit can be reduced without a lookup table. */
const CUBE_STEPS = [0, 95, 135, 175, 215, 255];

function nearestCube(v: number): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < CUBE_STEPS.length; i++) {
    const d = Math.abs((CUBE_STEPS[i] as number) - v);
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return best;
}

function rgbTo256(r: number, g: number, b: number): number {
  // Greyscale ramp is a better fit when the channels are close.
  if (Math.abs(r - g) < 8 && Math.abs(g - b) < 8) {
    if (r < 8) return 16;
    if (r > 248) return 231;
    return 232 + Math.round(((r - 8) / 247) * 23);
  }
  return 16 + 36 * nearestCube(r) + 6 * nearestCube(g) + nearestCube(b);
}

const ANSI16_RGB: [number, number, number][] = [
  [0, 0, 0], [205, 49, 49], [13, 188, 121], [229, 229, 16],
  [36, 114, 200], [188, 63, 188], [17, 168, 205], [229, 229, 229],
  [102, 102, 102], [241, 76, 76], [35, 209, 139], [245, 245, 67],
  [59, 142, 234], [214, 112, 214], [41, 184, 219], [255, 255, 255],
];

function rgbTo16(r: number, g: number, b: number): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < 16; i++) {
    const [cr, cg, cb] = ANSI16_RGB[i] as [number, number, number];
    const d = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return best;
}

function palette256ToRgb(idx: number): [number, number, number] {
  if (idx < 16) return ANSI16_RGB[idx] as [number, number, number];
  if (idx >= 232) {
    const v = 8 + (idx - 232) * 10;
    return [v, v, v];
  }
  const n = idx - 16;
  return [
    CUBE_STEPS[Math.floor(n / 36) % 6] as number,
    CUBE_STEPS[Math.floor(n / 6) % 6] as number,
    CUBE_STEPS[n % 6] as number,
  ];
}

/**
 * Reduce a colour to what the terminal can show. A component never picks a
 * fallback itself - it names a token, and this decides what that survives as.
 */
export function downsample(c: PackedColor, depth: ColorDepth): PackedColor {
  if (c === COLOR_DEFAULT) return c;
  if (depth === 0) return COLOR_DEFAULT;
  if (depth === 24) return c;

  if (isRgb(c)) {
    const [r, g, b] = unpackRgb(c);
    return depth === 8 ? rgbTo256(r, g, b) : rgbTo16(r, g, b);
  }
  if (depth === 8) return c;
  if (c < 16) return c;
  const [r, g, b] = palette256ToRgb(c);
  return rgbTo16(r, g, b);
}

/** Relative luminance, for picking readable foreground over a background. */
export function luminance(c: PackedColor): number {
  const [r, g, b] = isRgb(c) ? unpackRgb(c) : palette256ToRgb(c < 0 ? 0 : c);
  const f = (v: number): number => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** Mix two packed colours. `t` of 0 is `a`, 1 is `b`. */
export function mix(a: PackedColor, b: PackedColor, t: number): PackedColor {
  const [ar, ag, ab] = isRgb(a) ? unpackRgb(a) : palette256ToRgb(Math.max(0, a));
  const [br, bg, bb] = isRgb(b) ? unpackRgb(b) : palette256ToRgb(Math.max(0, b));
  return packRgb(
    Math.round(ar + (br - ar) * t),
    Math.round(ag + (bg - ag) * t),
    Math.round(ab + (bb - ab) * t),
  );
}

/**
 * A packed colour back as a `Color`, which is the shape a style takes.
 *
 * The inverse of `packColor`, for the places that compute a colour and then
 * have to hand it to a component - blending a tint out of two theme colours,
 * say. Painting goes the other way and should stay packed.
 */
export function unpackColor(packed: PackedColor): Color {
  if (packed === COLOR_DEFAULT) return 'default';
  if (isRgb(packed)) {
    const [r, g, b] = unpackRgb(packed);
    return { rgb: [r, g, b] };
  }
  return { palette: packed };
}

export function toHex(c: PackedColor): string {
  const [r, g, b] = isRgb(c) ? unpackRgb(c) : palette256ToRgb(Math.max(0, c));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
