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
   * Cells added after each copy, before the next one starts.
   *
   * Unset is flush, which is what a texture wants. Spacing turns the same tile
   * into a motif with air around it - the difference between wrapping paper
   * and a wallpaper: `10 + 10 = 20`, and `spacing.x = 5` makes it `25`.
   *
   * Not `gap`. A box already has one, it means the space between *children*,
   * and a component that used the same word for the space between copies of
   * its own tile would be two different distances under one name.
   */
  spacing?: { x?: number; y?: number };
  /**
   * Up to this many extra cells between copies, chosen at random per step.
   *
   * The standard name for it: a jitter is a random displacement applied to
   * positions that would otherwise be regular, and breaking a lattice is what
   * it is for. Not a deviation, which in statistics is a spread about a mean,
   * and not a factor, which is what it multiplied before it was a limit.
   *
   * A limit, not a factor: `jitter.x = 6` is "somewhere between flush and six
   * cells further on", dealt again for every step. Unset or `0` is the grid,
   * every copy exactly a tile from the last, which is what the default
   * preserves.
   *
   * It stacks with `spacing` rather than replacing it. Spacing is the air you
   * always want and this is how much more of it is left to chance, so
   * `spacing.x = 4, jitter.x = 6` steps by a tile plus four to ten.
   *
   * A jitter on `x` also stops the copies lining up into columns - see
   * `offsets`, and the screenshot that made it necessary.
   */
  jitter?: { x?: number; y?: number };
  /**
   * The deal, when there is a jitter.
   *
   * A pattern re-renders whenever its box changes, and one that reached for
   * `Math.random()` while painting would shuffle itself on every frame - a
   * texture that crawls. The seed makes the scatter a function of the props,
   * so the same pattern is the same pattern until somebody changes the number.
   */
  seed?: number;
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
 *
 * `-1` is "as many as fit", which with a gap or a deviation is not arithmetic
 * any more - it is however many the walk gets through. The count is an upper
 * bound there rather than the answer.
 */
function repeats(count: number | undefined, tile: number, room: number): number {
  if (count === undefined || count === 0) return 1;
  if (count < 0) return tile > 0 ? Math.ceil(room / tile) : 1;
  return count;
}

/**
 * A small deterministic generator, so a deviation is a deal rather than a
 * shuffle. `mulberry32`: the point is repeatability, not statistics.
 */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Where each copy starts along one axis.
 *
 * The step is a tile, plus whatever the gap and the deviation ask for:
 *
 * - neither - `tile`, which is the grid, and exactly what this drew before
 *   either of them existed
 * - spacing - `tile + spacing`, the same grid with air in it
 * - a deviation - `tile + rand * deviation * tile`, so `1` can skip a whole
 *   tile and land anywhere in the one after
 * - both - `tile + rand * deviation * spacing`, because once there is a
 *   spacing it is the spacing being shared out rather than the tile
 *
 * A jitter also moves where the walk *starts*, backwards, by up to a step.
 *
 * Without that, a tile as wide as the box is drawn once at zero and the
 * jitter has nothing to act on - there is no second copy for the step to
 * be different from, so every seed deals the same picture. It is the case a
 * sparse tile is most likely to be in: a big tile with two marks on it is
 * somebody scattering by hand, and the whole point of the seed there is that
 * the scatter moves.
 *
 * Backwards rather than forwards, so the phase shows as a different slice of
 * the pattern rather than as a blank margin down the left. The walk then needs
 * one more copy to reach the far edge, which is why `fill` extends the count.
 */
function offsets(
  count: number,
  tile: number,
  room: number,
  spacing: number,
  /** Up to this many extra cells per step. */
  jitter: number,
  next: () => number,
  /** Repeating to fill, rather than drawing a stated number of copies. */
  fill: boolean,
): number[] {
  if (tile <= 0) return [];
  const out: number[] = [];
  const step = tile + spacing;
  // Only when filling. A caller who asked for three copies put them there;
  // sliding those off the edge would be answering a different question.
  const phase = fill && jitter > 0
    ? -Math.round(next() * (step + jitter))
    : 0;
  let at = phase;
  const total = phase < 0 ? count + 1 : count;
  for (let i = 0; i < total && at < room; i++) {
    out.push(at);
    // A limit rather than a factor: the extra is somewhere in `0..jitter`,
    // dealt again for every step.
    at += step + (jitter > 0 ? Math.round(next() * jitter) : 0);
  }
  return out;
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
      spacing, jitter, seed = 1,
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

    // One generator for both axes, drawn from in a fixed order, so neither
    // depends on the box's size.
    const next = random(seed);
    const lines = offsets(
      down, tileHeight, room.height, spacing?.y ?? 0, jitter?.y ?? 0, next, (y ?? 0) < 0,
    );

    /*
     * A walk across for *each* row of copies, not one shared by all of them.
     *
     * This is what the difference between "irregular" and "not a lattice"
     * turns out to be. With one set of column positions, every row starts its
     * copies at the same offsets - so the copies still line up into columns,
     * and a sky of stars drawn that way still has visible rows and columns no
     * matter how uneven the spacing along each axis is. You can draw the grid
     * on a screenshot with a ruler, which is exactly what happened.
     *
     * Re-dealing the walk per row costs one pass each and breaks the
     * alignment, because row two's copies are nowhere near row one's.
     * Without a jitter there is nothing to re-deal, so the walk is
     * computed once and shared - and the output is the grid it always was.
     */
    const shared = (jitter?.x ?? 0) === 0
      ? offsets(across, tileWidth, room.width, spacing?.x ?? 0, 0, next, (x ?? 0) < 0)
      : null;
    const columnsFor = (): number[] => shared ?? offsets(
      across, tileWidth, room.width, spacing?.x ?? 0, jitter?.x ?? 0, next, (x ?? 0) < 0,
    );
    /*
     * Every copy placed on its own, not as a cell of a grid.
     *
     * Re-dealing the walk per row breaks the columns; it does not break the
     * rows, because every copy in one row still shares a `top`. A sky drawn
     * that way still has marks lined up in bands - which is visible the
     * moment somebody puts a ruler on a screenshot.
     *
     * So a copy also wobbles up or down by its own amount, out of the same
     * budget as the vertical step. That is the last thing holding the lattice
     * together, and with it gone the placements are a scatter that happens to
     * have been generated in reading order.
     */
    const wobble = jitter?.y ?? 0;
    const placements = lines.flatMap((top) => columnsFor().map((left) => ({
      left,
      top: wobble > 0 ? top + Math.round(next() * wobble) - Math.round(wobble / 2) : top,
    })));

    const widest = Math.max(0, ...placements.map(({ left }) => left + tileWidth));
    const last = {
      x: Math.max(0, widest),
      y: Math.max(0, (lines[lines.length - 1] ?? 0) + tileHeight),
    };
    const painted = {
      width: Math.min(last.x, room.width),
      height: Math.min(last.y, room.height),
    };

    /*
     * Stamped into a grid, then split into runs.
     *
     * The rows used to be built by repeating the tile's own string, which is
     * shorter and only works while every copy is exactly a tile from the last.
     * With a gap or a deviation the copies are at arbitrary offsets, so the
     * grid is composed first and read off afterwards - and the reading is the
     * same `runs` split as before, which is what keeps a transparent cell
     * transparent and adjacent cells in one `text` rather than one apiece.
     *
     * With neither prop set the offsets come out as `0, tile, 2*tile, ...` and
     * the composed rows are identical to what the repeat produced.
     */
    const cells: RenderOutput[] = [];
    if (tileWidth > 0 && painted.width > 0 && painted.height > 0) {
      const blank = transparent ?? ' ';
      const grid = Array.from(
        { length: painted.height },
        () => Array.from({ length: painted.width }, () => blank),
      );

      for (const { top, left } of placements) {
        for (let r = 0; r < tileHeight; r++) {
          // A phased or wobbled copy starts above and to the left of the box,
          // so part of it is outside. Those cells are simply not written; the
          // rest of the copy still lands.
          const row = grid[top + r];
          if (top + r < 0 || !row) continue;
          const source = [...(rows[r] as string)];
          for (let c = 0; c < tileWidth; c++) {
            const at = left + c;
            if (at >= 0 && at < painted.width) row[at] = source[c] as string;
          }
        }
      }

      grid.forEach((row, y1) => {
        for (const run of runs(row.join(''), transparent)) {
          cells.push(
            <text
              key={`${y1}:${run.at}`}
              position="absolute"
              top={y1}
              left={run.at}
              content={run.text}
            />,
          );
        }
      });
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
