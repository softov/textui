import type { PaintSurface, RenderContext, StyleColor } from '@textui/core';
import type { GameGlyphs } from './glyphs.js';

/**
 * What a game is.
 *
 * A state machine and a painter, neither of which knows it is in a terminal:
 * `step` is handed elapsed milliseconds, `key` is handed a direction, and
 * `draw` is handed a field of cells. That is what lets one play screen mount
 * any of them without knowing which, and it is what lets the rules be tested
 * without mounting anything at all - `test/games.test.ts` never starts an
 * application.
 *
 * Game state is mutable and lives in a ref, which is the one place this
 * example steps outside "the store is the only state". The store is the
 * application's state - what is selected, which game, the high scores, all of
 * which are written here. A tetromino's y position thirty times a second is
 * the *frame*, not the application: putting it in the store would make every
 * subscriber recompute on every tick to describe something that is gone by
 * the next one.
 */

export type Rng = () => number;

/** Seeded, because a game that draws from `Math.random` cannot be tested. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Five keys, because three games needed five between them.
 *
 * The screen does the mapping - arrows, `wasd` and `hjkl` all arrive here as
 * the same five - so a game states what `up` means to it and no game contains
 * a second copy of the keyboard layout.
 */
export type GameKey = 'left' | 'right' | 'up' | 'down' | 'action';

export type Mark = 'solid' | 'soft' | 'food' | 'wall';

export interface Field {
  /** Cells. One cell is two terminal columns wide and one row tall. */
  width: number;
  height: number;
}

export interface GameStatus {
  score: number;
  /** Whatever this game counts: lines, level, lives. Shown beside the field. */
  stats: { label: string; value: string }[];
  over: boolean;
  /** Drawn across the middle of the field when set. */
  banner?: string;
}

export interface Game<S = unknown> {
  id: string;
  title: string;
  blurb: string;
  field: Field;
  /**
   * What the bottom edge of the field is.
   *
   * The frame around a field is not decoration - it is where the walls are,
   * and a player reads it as the rules. Breakout is the one game whose floor
   * is not a wall, so its frame is drawn without one: a line the ball falls
   * straight through is a line that lied.
   */
  floor?: 'wall' | 'open';
  /** For the footer and the cabinet's side panel. */
  controls: { keys: string; label: string }[];
  create(rng: Rng): S;
  /** Advance by `ms`. A game keeps its own clock inside its own state. */
  step(state: S, ms: number): void;
  key(state: S, key: GameKey): void;
  draw(state: S, painter: FieldPainter): void;
  status(state: S): GameStatus;
}

/**
 * How much terminal a game needs, in cells.
 *
 * The field, the frame that is its walls, the score pane beside it and the two
 * rows of chrome above and below. One formula, because the cabinet promises a
 * size before you start and the play screen decides whether it can draw - and
 * those two disagreeing is how you get a game that says it fits and then does
 * not.
 */
export function roomFor(game: Game): Field {
  return {
    width: game.field.width * 2 + 2 + SCORE_WIDTH + 1,
    height: game.field.height + (game.floor === 'open' ? 1 : 2) + 4,
  };
}

/** The score pane. Fixed, because a score that moves is a score you re-find. */
export const SCORE_WIDTH = 17;

/**
 * The field, as something to draw on.
 *
 * Two resolutions, because two is what the games need. A cell is the unit
 * everything is laid out in - a brick, a tetromino block, a segment of snake.
 * A dot is half a cell each way, which is one terminal column and half a row,
 * and it exists so the ball in Breakout can be somewhere other than exactly on
 * the grid the bricks are on.
 */
export interface FieldPainter {
  readonly width: number;
  readonly height: number;
  /** Fill a whole cell. */
  cell(x: number, y: number, mark: Mark, color: StyleColor): void;
  /** One dot: `0 <= col < width * 2`, `0 <= row < height * 2`. */
  dot(col: number, row: number, color: StyleColor): void;
  /** Text inside the field, positioned in cells and clipped to it. */
  label(x: number, y: number, text: string, color: StyleColor): void;
  /** Text centred across the field. Where a banner goes. */
  centre(y: number, text: string, color: StyleColor): void;
}

interface CellState {
  mark?: Mark;
  color?: StyleColor;
  /** Two dots per cell, left column then right, top row then bottom. */
  dots: (StyleColor | undefined)[];
}

interface Label {
  /** Terminal columns from the left of the field, so a label can start on the
   * right half of a cell - centring a nine-character word in a ten-cell field
   * otherwise lands it half a cell off. */
  column: number;
  row: number;
  text: string;
  color: StyleColor;
}

export interface FlushablePainter extends FieldPainter {
  /**
   * Write what was collected. The context is what resolves a game's colour
   * tokens: a game says `danger` and the theme in force says what that is, so
   * the same brick is the right red in all four themes and a readable grey on
   * a terminal with no colour at all.
   */
  flush(surface: PaintSurface, ctx: RenderContext, originX: number, originY: number): void;
}

/**
 * A painter that collects, then writes once.
 *
 * Collecting first is what lets two dots share a cell: the glyph for "the top
 * dot and the bottom dot of this column are both lit" is a full block, and
 * that cannot be decided until both have been drawn. Painting straight to the
 * surface would make the second write erase the first.
 */
export function createPainter(field: Field, glyphs: GameGlyphs): FlushablePainter {
  const cells: CellState[] = Array.from(
    { length: field.width * field.height },
    () => ({ dots: [undefined, undefined, undefined, undefined] }),
  );
  const labels: Label[] = [];
  const at = (x: number, y: number): CellState | undefined =>
    x >= 0 && y >= 0 && x < field.width && y < field.height
      ? cells[y * field.width + x]
      : undefined;

  return {
    width: field.width,
    height: field.height,

    cell(x, y, mark, color) {
      const target = at(Math.round(x), Math.round(y));
      if (!target) return;
      target.mark = mark;
      target.color = color;
    },

    dot(col, row, color) {
      const c = Math.floor(col);
      const r = Math.floor(row);
      const target = at(Math.floor(c / 2), Math.floor(r / 2));
      if (!target) return;
      target.dots[(r % 2) * 2 + (c % 2)] = color;
    },

    label(x, y, text, color) {
      labels.push({ column: Math.round(x * 2), row: Math.round(y), text, color });
    },

    centre(y, text, color) {
      // In columns, not cells: centring in cells puts an odd-length word half
      // a cell off, which is a whole column on the screen.
      labels.push({
        column: Math.round((field.width * 2 - text.length) / 2),
        row: Math.round(y),
        text,
        color,
      });
    },

    flush(surface, ctx, originX, originY) {
      for (let y = 0; y < field.height; y++) {
        for (let x = 0; x < field.width; x++) {
          const state = cells[y * field.width + x];
          if (!state) continue;
          const sx = originX + x * 2;
          const sy = originY + y;

          if (state.mark) {
            surface.text(sx, sy, glyphs[state.mark], { fg: ctx.color(state.color) });
            continue;
          }
          for (const column of [0, 1]) {
            const top = state.dots[column];
            const bottom = state.dots[2 + column];
            const glyph = top && bottom ? glyphs.dotFull
              : top ? glyphs.dotTop
                : bottom ? glyphs.dotBottom : null;
            if (glyph) surface.put(sx + column, sy, glyph, { fg: ctx.color(top ?? bottom) });
          }
        }
      }

      // Labels last, and over the top: "Game over" is written across a field
      // that is still there behind it.
      for (const label of labels) {
        if (label.row < 0 || label.row >= field.height) continue;
        const room = field.width * 2 - label.column;
        if (room <= 0) continue;
        surface.text(
          originX + Math.max(0, label.column),
          originY + label.row,
          label.text.slice(0, room),
          { fg: ctx.color(label.color) },
        );
      }
    },
  };
}
