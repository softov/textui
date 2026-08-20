import type { Rect } from '../types/geometry.js';
import type { Cell, CellBuffer } from '../types/cells.js';
import { COLOR_DEFAULT, packColor, type PackedColor } from './color.js';
import { graphemeWidth } from '../util/text.js';

/** Internal cell flags, kept out of the public attrs bitfield. */
export const FLAG_CONTINUATION = 1;

/**
 * The frame.
 *
 * Cells live in parallel arrays rather than objects because the diff walks
 * every cell of every frame, and one allocation per cell per frame is the
 * difference between a smooth redraw and a visibly stuttering one.
 */
export class Buffer implements CellBuffer {
  width: number;
  height: number;

  chars: string[];
  fg: Int32Array;
  bg: Int32Array;
  attrs: Uint16Array;
  flags: Uint8Array;
  links: (string | undefined)[];

  private prevChars: string[];
  private prevFg: Int32Array;
  private prevBg: Int32Array;
  private prevAttrs: Uint16Array;
  private prevLinks: (string | undefined)[];
  private committed = false;

  constructor(width: number, height: number) {
    this.width = Math.max(0, width);
    this.height = Math.max(0, height);
    const n = this.width * this.height;
    this.chars = new Array<string>(n).fill(' ');
    this.fg = new Int32Array(n).fill(COLOR_DEFAULT);
    this.bg = new Int32Array(n).fill(COLOR_DEFAULT);
    this.attrs = new Uint16Array(n);
    this.flags = new Uint8Array(n);
    this.links = new Array<string | undefined>(n).fill(undefined);

    this.prevChars = new Array<string>(n).fill(' ');
    this.prevFg = new Int32Array(n).fill(COLOR_DEFAULT);
    this.prevBg = new Int32Array(n).fill(COLOR_DEFAULT);
    this.prevAttrs = new Uint16Array(n);
    this.prevLinks = new Array<string | undefined>(n).fill(undefined);
  }

  /** Cell-object access, for the `CellBuffer` contract and the test harness. */
  get(x: number, y: number): Cell | undefined {
    if (!this.inBounds(x, y)) return undefined;
    const i = this.index(x, y);
    return {
      char: this.chars[i] as string,
      fg: packedToColor(this.fg[i] as number),
      bg: packedToColor(this.bg[i] as number),
      attrs: this.attrs[i] as number,
      link: this.links[i],
      continuation: ((this.flags[i] as number) & FLAG_CONTINUATION) !== 0,
    };
  }

  set(x: number, y: number, cell: Cell): void {
    this.put(
      x, y, cell.char,
      packColor(cell.fg), packColor(cell.bg), cell.attrs, cell.link,
    );
  }

  index(x: number, y: number): number {
    return y * this.width + x;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  /**
   * Write one grapheme. A double-width grapheme claims the next cell as a
   * continuation, and writing over either half clears the other - otherwise a
   * half-overwritten wide character shifts every cell after it on that row.
   */
  put(
    x: number,
    y: number,
    char: string,
    fg: PackedColor = COLOR_DEFAULT,
    bg: PackedColor = COLOR_DEFAULT,
    attrs = 0,
    link?: string,
  ): void {
    if (!this.inBounds(x, y)) return;
    const i = this.index(x, y);

    // Overwriting the right half of a wide pair: blank the left half.
    if (((this.flags[i] as number) & FLAG_CONTINUATION) !== 0 && x > 0) {
      this.chars[i - 1] = ' ';
      this.flags[i - 1] = 0;
    }
    // Overwriting a wide left half: blank its continuation.
    if (x + 1 < this.width && ((this.flags[i + 1] as number) & FLAG_CONTINUATION) !== 0) {
      this.chars[i + 1] = ' ';
      this.flags[i + 1] = 0;
    }

    const w = graphemeWidth(char);
    if (w === 0) return;

    this.chars[i] = char;
    this.fg[i] = fg;
    this.bg[i] = bg;
    this.attrs[i] = attrs;
    this.flags[i] = 0;
    this.links[i] = link;

    if (w === 2) {
      if (x + 1 >= this.width) {
        // A wide grapheme in the last column cannot render; blank it.
        this.chars[i] = ' ';
        return;
      }
      const j = i + 1;
      if (x + 2 < this.width && ((this.flags[j + 1] as number) & FLAG_CONTINUATION) !== 0) {
        this.chars[j + 1] = ' ';
        this.flags[j + 1] = 0;
      }
      this.chars[j] = '';
      this.fg[j] = fg;
      this.bg[j] = bg;
      this.attrs[j] = attrs;
      this.flags[j] = FLAG_CONTINUATION;
      this.links[j] = link;
    }
  }

  clear(rect?: Rect, bg: PackedColor = COLOR_DEFAULT): void {
    const r = rect ?? { x: 0, y: 0, width: this.width, height: this.height };
    for (let y = r.y; y < r.y + r.height; y++) {
      if (y < 0 || y >= this.height) continue;
      for (let x = r.x; x < r.x + r.width; x++) {
        if (x < 0 || x >= this.width) continue;
        const i = this.index(x, y);
        this.chars[i] = ' ';
        this.fg[i] = COLOR_DEFAULT;
        this.bg[i] = bg;
        this.attrs[i] = 0;
        this.flags[i] = 0;
        this.links[i] = undefined;
      }
    }
  }

  resize(width: number, height: number): void {
    if (width === this.width && height === this.height) return;
    const next = new Buffer(width, height);
    const w = Math.min(width, this.width);
    const h = Math.min(height, this.height);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const from = this.index(x, y);
        const to = next.index(x, y);
        next.chars[to] = this.chars[from] as string;
        next.fg[to] = this.fg[from] as number;
        next.bg[to] = this.bg[from] as number;
        next.attrs[to] = this.attrs[from] as number;
        next.flags[to] = this.flags[from] as number;
        next.links[to] = this.links[from];
      }
    }
    this.width = next.width;
    this.height = next.height;
    this.chars = next.chars;
    this.fg = next.fg;
    this.bg = next.bg;
    this.attrs = next.attrs;
    this.flags = next.flags;
    this.links = next.links;

    // A resize invalidates the previous frame entirely.
    const n = width * height;
    this.prevChars = new Array<string>(n).fill(' ');
    this.prevFg = new Int32Array(n).fill(COLOR_DEFAULT);
    this.prevBg = new Int32Array(n).fill(COLOR_DEFAULT);
    this.prevAttrs = new Uint16Array(n);
    this.prevLinks = new Array<string | undefined>(n).fill(undefined);
    this.committed = false;
  }

  cellChanged(i: number): boolean {
    return (
      this.chars[i] !== this.prevChars[i] ||
      this.fg[i] !== this.prevFg[i] ||
      this.bg[i] !== this.prevBg[i] ||
      this.attrs[i] !== this.prevAttrs[i] ||
      this.links[i] !== this.prevLinks[i]
    );
  }

  dirtyRows(): number[] {
    if (!this.committed) {
      return Array.from({ length: this.height }, (_, y) => y);
    }
    const rows: number[] = [];
    for (let y = 0; y < this.height; y++) {
      const start = y * this.width;
      for (let x = 0; x < this.width; x++) {
        if (this.cellChanged(start + x)) {
          rows.push(y);
          break;
        }
      }
    }
    return rows;
  }

  commit(): void {
    this.prevChars = this.chars.slice();
    this.prevFg = this.fg.slice();
    this.prevBg = this.bg.slice();
    this.prevAttrs = this.attrs.slice();
    this.prevLinks = this.links.slice();
    this.committed = true;
  }

  /** Force the next diff to repaint everything. After a resize or a redraw. */
  invalidate(): void {
    this.committed = false;
  }

  toText(rect?: Rect): string {
    const r = rect ?? { x: 0, y: 0, width: this.width, height: this.height };
    const lines: string[] = [];
    for (let y = r.y; y < r.y + r.height; y++) {
      if (y < 0 || y >= this.height) continue;
      let line = '';
      for (let x = r.x; x < r.x + r.width; x++) {
        if (x < 0 || x >= this.width) continue;
        const i = this.index(x, y);
        if (((this.flags[i] as number) & FLAG_CONTINUATION) !== 0) continue;
        line += this.chars[i] as string;
      }
      lines.push(line.replace(/[ ]+$/, ''));
    }
    return lines.join('\n');
  }
}

export function createBuffer(width: number, height: number): Buffer {
  return new Buffer(width, height);
}

function packedToColor(packed: PackedColor): Cell['fg'] {
  if (packed === COLOR_DEFAULT) return 'default';
  if (packed >= 0x1000000) {
    return { rgb: [(packed >> 16) & 0xff, (packed >> 8) & 0xff, packed & 0xff] };
  }
  return { palette: packed };
}
