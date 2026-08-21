import type { CellBuffer, ColorDepth, TerminalCapabilities } from '@textui/core';
import { COLOR_DEFAULT, packColor } from '@textui/core';
import { ATTR_ON, bgSequence, fgSequence } from './writer.js';
import * as ansi from './ansi.js';

/**
 * A frame, as a string you can keep.
 *
 * This is not what `Writer` does. The writer's job is to get from the frame on
 * screen to the next one in as few bytes as it can, so what it emits is cursor
 * moves and the differences between them - correct on a live terminal and
 * meaningless in a file. A capture is the opposite: every cell, in order, rows
 * separated by newlines and no cursor control at all, so it can be written to
 * a file, piped, pasted into a bug report, or `cat`ed back with nothing else
 * on screen having to be true.
 *
 * A terminal application cannot show you what it looked like when it went
 * wrong - the screen is the output, and the next redraw destroys the evidence.
 * This is how it hands you the evidence instead.
 */
export interface CaptureOptions {
  /** Emit SGR colour. Off gives plain text, which is what a diff can read. */
  colors?: boolean;
  /** Reduce colour to this depth. Defaults to what the terminal reported. */
  colorDepth?: ColorDepth;
}

export function captureBuffer(
  buffer: CellBuffer,
  capabilities: TerminalCapabilities,
  options: CaptureOptions = {},
): string {
  const depth = options.colorDepth ?? capabilities.colorDepth;
  const colors = (options.colors ?? true) && depth > 0;
  const rows: string[] = [];

  for (let y = 0; y < buffer.height; y++) {
    let row = '';
    let fg = COLOR_DEFAULT;
    let bg = COLOR_DEFAULT;
    let attrs = 0;
    // Where the row last stopped being blank. A run of default-styled spaces
    // at the end is trailing whitespace; the same run with a background is a
    // part of the picture, so only the first kind is trimmed.
    let end = 0;
    let plain = '';

    for (let x = 0; x < buffer.width; x++) {
      const cell = buffer.get(x, y);
      if (!cell || cell.continuation === true) continue;

      const cellFg = packColor(cell.fg);
      const cellBg = packColor(cell.bg);
      const cellAttrs = cell.attrs;

      if (colors && (cellFg !== fg || cellBg !== bg || cellAttrs !== attrs)) {
        const codes: (string | number)[] = [];
        // One reset and a restatement, rather than eight ways to turn things
        // off - the same trade the writer makes, for the same reason.
        if ((attrs & ~cellAttrs) !== 0) {
          codes.push(ansi.SGR.reset);
          fg = COLOR_DEFAULT;
          bg = COLOR_DEFAULT;
          attrs = 0;
        }
        for (const [bit, code] of ATTR_ON) {
          if (cellAttrs & bit & ~attrs) codes.push(code);
        }
        if (cellFg !== fg) codes.push(fgSequence(cellFg, depth));
        if (cellBg !== bg) codes.push(bgSequence(cellBg, depth));
        if (codes.length > 0) row += `${ansi.CSI}${codes.join(';')}m`;
        fg = cellFg;
        bg = cellBg;
        attrs = cellAttrs;
      }

      row += cell.char;
      plain += cell.char;
      if (cell.char !== ' ' || cellBg !== COLOR_DEFAULT || cellAttrs !== 0) end = plain.length;
    }

    const styled = colors && (fg !== COLOR_DEFAULT || bg !== COLOR_DEFAULT || attrs !== 0);
    if (end < plain.length) {
      // Nothing after the last real cell, so drop it - and reset first, or the
      // last colour bleeds to the edge of whatever terminal shows this.
      row = trimTail(row, plain.length - end);
      if (styled) row += `${ansi.CSI}${ansi.SGR.reset}m`;
    } else if (styled) {
      row += `${ansi.CSI}${ansi.SGR.reset}m`;
    }

    rows.push(row);
  }

  return rows.join('\n');
}

/** Drop `count` characters from the end, which are known to be plain spaces. */
function trimTail(row: string, count: number): string {
  return count <= 0 ? row : row.slice(0, row.length - count);
}
