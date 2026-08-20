import type { Rect } from './geometry.js';

/**
 * A color is either a token name resolved through the theme, a 24-bit RGB
 * value, a 256-palette index, or one of the 16 ANSI names. The renderer
 * downsamples to whatever `colorDepth` allows - a component never picks a
 * fallback itself.
 */
export type AnsiColorName =
  | 'black' | 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white'
  | 'brightBlack' | 'brightRed' | 'brightGreen' | 'brightYellow'
  | 'brightBlue' | 'brightMagenta' | 'brightCyan' | 'brightWhite';

export type Color =
  | AnsiColorName
  | `#${string}`
  | { rgb: [number, number, number] }
  | { palette: number }
  | 'default';

/** Text attributes as a bitfield - one number per cell, cheap to diff. */
export const ATTR_NONE = 0;
export const ATTR_BOLD = 1 << 0;
export const ATTR_DIM = 1 << 1;
export const ATTR_ITALIC = 1 << 2;
export const ATTR_UNDERLINE = 1 << 3;
export const ATTR_BLINK = 1 << 4;
export const ATTR_INVERSE = 1 << 5;
export const ATTR_HIDDEN = 1 << 6;
export const ATTR_STRIKE = 1 << 7;

export type Attrs = number;

/**
 * One terminal cell. `char` is a full grapheme cluster (may be several code
 * points). A wide grapheme occupies this cell and marks the next one
 * `continuation`, which the writer skips.
 */
export interface Cell {
  char: string;
  fg: Color;
  bg: Color;
  attrs: Attrs;
  /** OSC 8 target, when the terminal supports hyperlinks. */
  link?: string;
  /** True for the right half of a double-width grapheme. */
  continuation?: boolean;
}

export interface CellBuffer {
  readonly width: number;
  readonly height: number;
  get(x: number, y: number): Cell | undefined;
  set(x: number, y: number, cell: Cell): void;
  /** Rows that changed since `commit()`. Empty when nothing moved. */
  dirtyRows(): number[];
  commit(): void;
  clear(rect?: Rect): void;
  resize(width: number, height: number): void;
  /** Plain text, no attributes. The testing harness reads this. */
  toText(rect?: Rect): string;
}

/** One contiguous run of identical-style cells - what the ANSI writer emits. */
export interface CellRun {
  x: number;
  y: number;
  text: string;
  fg: Color;
  bg: Color;
  attrs: Attrs;
  link?: string;
}

export interface FrameDiff {
  runs: CellRun[];
  /** Where the hardware cursor should end up, or null to keep it hidden. */
  cursor: { x: number; y: number; visible: boolean } | null;
}
