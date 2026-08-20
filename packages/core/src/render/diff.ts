import type { Buffer } from './buffer.js';
import { FLAG_CONTINUATION } from './buffer.js';
import type { PackedColor } from './color.js';

/** One contiguous run of identical-style cells - what the writer emits. */
export interface Run {
  x: number;
  y: number;
  text: string;
  fg: PackedColor;
  bg: PackedColor;
  attrs: number;
  link: string | undefined;
}

export interface Frame {
  runs: Run[];
  cursor: { x: number; y: number; visible: boolean } | null;
  /** True when every row was emitted - first frame, or after invalidate. */
  full: boolean;
}

/**
 * Turn changed cells into runs.
 *
 * Two economies matter here and nowhere else: only touched rows are walked,
 * and within a row, adjacent changed cells sharing a style become one run, so
 * a redraw costs one cursor move and one SGR change per run rather than per
 * cell. A run continues through a short stretch of unchanged cells when
 * repainting them is cheaper than moving the cursor around them.
 */
export function diffFrame(
  buffer: Buffer,
  cursor: { x: number; y: number; visible: boolean } | null = null,
  gapTolerance = 4,
): Frame {
  const runs: Run[] = [];
  const rows = buffer.dirtyRows();
  const full = rows.length === buffer.height && buffer.height > 0;

  for (const y of rows) {
    const base = y * buffer.width;
    let x = 0;

    while (x < buffer.width) {
      const i = base + x;
      if (((buffer.flags[i] as number) & FLAG_CONTINUATION) !== 0 || !buffer.cellChanged(i)) {
        x++;
        continue;
      }

      const fg = buffer.fg[i] as number;
      const bg = buffer.bg[i] as number;
      const attrs = buffer.attrs[i] as number;
      const link = buffer.links[i];

      let text = '';
      let cx = x;
      let gap = 0;
      let pendingGap = '';

      while (cx < buffer.width) {
        const j = base + cx;
        if (((buffer.flags[j] as number) & FLAG_CONTINUATION) !== 0) {
          cx++;
          continue;
        }

        const sameStyle =
          buffer.fg[j] === fg &&
          buffer.bg[j] === bg &&
          buffer.attrs[j] === attrs &&
          buffer.links[j] === link;
        if (!sameStyle) break;

        if (buffer.cellChanged(j)) {
          if (pendingGap !== '') {
            text += pendingGap;
            pendingGap = '';
            gap = 0;
          }
          text += buffer.chars[j] as string;
          cx++;
          continue;
        }

        gap++;
        if (gap > gapTolerance) break;
        pendingGap += buffer.chars[j] as string;
        cx++;
      }

      if (text !== '') runs.push({ x, y, text, fg, bg, attrs, link });
      x = cx > x ? cx : x + 1;
    }
  }

  return { runs, cursor, full };
}
