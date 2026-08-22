import { defineComponent, useCapabilities, useMeasure } from '@textui/core';
import type { BoxProps, RenderOutput } from '@textui/core';

/**
 * A tile, repeated.
 *
 * Written here rather than in the library so it can be exercised against real
 * screens before it earns a place in the catalog. Nothing in it is playground
 * specific - it uses `useMeasure` and absolute positioning and nothing else.
 *
 * The two modes are document order and not much else. Painting walks the tree
 * in the order components were written, so a layer emitted before the children
 * ends up under them and one emitted after ends up over them. `zIndex` looks
 * like it should decide this and does not: it sorts the layout boxes, while
 * `paintTree` walks the instance children, so the property is inert for
 * painting today. Relying on order is what actually works.
 */

export interface PatternProps extends BoxProps {
  /** The tile. One string per row, or one string with newlines in it. */
  tile: string | string[];
  /**
   * The tile to draw on a terminal that cannot manage the first one.
   *
   * A pattern is the one component whose whole content is glyphs, so it is the
   * one that breaks worst on an `unicode: 'ascii'` terminal - and unlike a
   * border, the library cannot guess a fallback for a tile it has never seen.
   * Whoever picks the glyphs picks the substitute.
   */
  ascii?: string | string[];
  /**
   * Repeats across.
   *
   * Unset or `0` draws the tile once. `-1` repeats until the box runs out.
   * A positive number draws that many, and the box still clips it.
   */
  x?: number;
  /** Repeats down. Same rules as `x`. */
  y?: number;
  /** Stop short of the box, in cells. Unset means the box decides. */
  limit?: { width?: number; height?: number };
  /**
   * Cells holding this character are left unpainted, so whatever is behind
   * shows through. `null` paints every cell, spaces included.
   */
  transparent?: string | null;
  /** Paint under the children. The default, and what a texture wants. */
  asBackground?: boolean;
  /** Paint over the children instead. */
  asOverlay?: boolean;
}

/**
 * The tile as equal-length rows. A ragged tile pads rather than tears.
 *
 * Only the blank rows at the ends go - those are how a string written across
 * several lines begins and ends. A blank row in the middle is a row of
 * transparent cells somebody drew on purpose, and dropping it silently
 * shortens their tile.
 */
function rowsOf(tile: string | string[]): string[] {
  const rows = Array.isArray(tile) ? [...tile] : tile.split('\n');
  while (rows.length > 0 && rows[0] === '') rows.shift();
  while (rows.length > 0 && rows[rows.length - 1] === '') rows.pop();

  const width = Math.max(0, ...rows.map((row) => [...row].length));
  return rows.map((row) => row.padEnd(width, ' '));
}

/**
 * How many copies to draw along one axis.
 *
 * Unset and zero mean the same thing - once, no repetition - because "repeat
 * it zero times" and "do not repeat it" are the same request, and treating
 * zero as *nothing at all* makes an unset prop and a computed one behave
 * differently for no reason anyone would want.
 */
function repeats(count: number | undefined, tile: number, room: number): number {
  if (count === undefined || count === 0) return 1;
  if (count < 0) return tile > 0 ? Math.ceil(room / tile) : 1;
  return count;
}

/** The runs of paintable cells in one row, so gaps stay see-through. */
function runs(row: string, transparent: string | null): { at: number; text: string }[] {
  const cells = [...row];
  if (transparent === null) return cells.length > 0 ? [{ at: 0, text: row }] : [];

  const out: { at: number; text: string }[] = [];
  let start = -1;
  for (let i = 0; i <= cells.length; i++) {
    const paint = i < cells.length && cells[i] !== transparent;
    if (paint && start < 0) start = i;
    else if (!paint && start >= 0) {
      out.push({ at: start, text: cells.slice(start, i).join('') });
      start = -1;
    }
  }
  return out;
}

export const Pattern: (props: PatternProps) => RenderOutput = defineComponent<PatternProps>(
  'Pattern',
  (props) => {
    const {
      tile, ascii, x, y, limit, transparent = ' ',
      asOverlay, asBackground: _asBackground, children, ...rest
    } = props;

    const capabilities = useCapabilities();

    // The box this pattern was given. Zero on the first pass, real on the
    // second - which is why `-1` needs a frame to find its extent.
    const measured = useMeasure();

    const rows = rowsOf(capabilities.unicode === 'ascii' && ascii !== undefined ? ascii : tile);
    const tileWidth = rows[0] ? [...rows[0]].length : 0;
    const tileHeight = rows.length;

    const room = {
      width: Math.min(measured.width, limit?.width ?? Number.POSITIVE_INFINITY),
      height: Math.min(measured.height, limit?.height ?? Number.POSITIVE_INFINITY),
    };

    const across = repeats(x, tileWidth, room.width);
    const down = repeats(y, tileHeight, room.height);

    const painted = {
      width: Math.min(across * tileWidth, room.width),
      height: Math.min(down * tileHeight, room.height),
    };

    const cells: RenderOutput[] = [];
    if (tileWidth > 0 && painted.width > 0 && painted.height > 0) {
      for (let row = 0; row < painted.height; row++) {
        const source = rows[row % tileHeight] as string;
        const line = [...source.repeat(across)].slice(0, painted.width).join('');
        for (const run of runs(line, transparent)) {
          cells.push(
            <text
              key={`${row}:${run.at}`}
              position="absolute"
              top={row}
              left={run.at}
              content={run.text}
            />,
          );
        }
      }
    }

    // Absolute, so the pattern never pushes the children around, and hidden,
    // so a partial tile at the edge is cut rather than allowed to overflow.
    const layer = (
      <box
        position="absolute"
        top={0}
        left={0}
        width={painted.width}
        height={painted.height}
        overflow="hidden"
      >
        {cells}
      </box>
    );

    return (
      <box position="relative" {...rest}>
        {asOverlay === true ? [children, layer] : [layer, children]}
      </box>
    );
  },
);
