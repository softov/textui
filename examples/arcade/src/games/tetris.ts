import type { FieldPainter, Game, Rng } from '../engine.js';
import type { StyleColor } from '@textui/core';

/**
 * Tetris.
 *
 * The field is wider than the well on purpose. A "next piece" pane would have
 * to be described in the status contract - a shape, in colour, which no other
 * game has - so the well, the wall and the preview are all just cells this
 * game draws. What a game owns is its whole field, and the cabinet stays free
 * of anything shaped like a tetromino.
 */

const WELL = { width: 10, height: 20 };
const PREVIEW_X = WELL.width + 2;
const FIELD = { width: WELL.width + 6, height: WELL.height };

interface Shape {
  size: number;
  cells: [number, number][];
  color: StyleColor;
}

/**
 * The seven, each in a box it rotates inside. Rotating a coordinate rather
 * than storing four copies of every piece is the same rule the rest of this
 * repo follows: one description, derived four ways.
 */
const SHAPES: Record<string, Shape> = {
  I: { size: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]], color: 'info' },
  O: { size: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]], color: 'warning' },
  T: { size: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]], color: 'secondary' },
  S: { size: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]], color: 'success' },
  Z: { size: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]], color: 'danger' },
  J: { size: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]], color: 'primary' },
  L: { size: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]], color: 'accent' },
};
const KINDS = Object.keys(SHAPES);

export interface Piece { kind: string; rotation: number; x: number; y: number }

export interface TetrisState {
  /** The well, row-major. A cell holds the colour it was locked with. */
  grid: (StyleColor | null)[];
  piece: Piece;
  next: string;
  score: number;
  lines: number;
  level: number;
  over: boolean;
  elapsed: number;
  rng: Rng;
}

/** Rotate inside the piece's own box: (x, y) -> (size - 1 - y, x). */
export function cellsOf(piece: Piece): [number, number][] {
  const shape = SHAPES[piece.kind];
  if (!shape) return [];
  let cells = shape.cells;
  for (let turn = 0; turn < ((piece.rotation % 4) + 4) % 4; turn++) {
    cells = cells.map(([x, y]) => [shape.size - 1 - y, x] as [number, number]);
  }
  return cells.map(([x, y]) => [piece.x + x, piece.y + y] as [number, number]);
}

function colorOf(kind: string): StyleColor {
  return SHAPES[kind]?.color ?? 'text';
}

function blocked(state: TetrisState, piece: Piece): boolean {
  return cellsOf(piece).some(([x, y]) => {
    if (x < 0 || x >= WELL.width || y >= WELL.height) return true;
    // Above the ceiling is not a collision - a piece spawns partly there and
    // has to be allowed to fall in.
    if (y < 0) return false;
    return state.grid[y * WELL.width + x] != null;
  });
}

function spawn(state: TetrisState): void {
  const kind = state.next;
  state.next = KINDS[Math.floor(state.rng() * KINDS.length)] ?? 'T';
  const shape = SHAPES[kind];
  state.piece = {
    kind,
    rotation: 0,
    x: Math.floor((WELL.width - (shape?.size ?? 3)) / 2),
    y: -1,
  };
  // No room for the piece that just arrived: the well is full, and that is
  // what "game over" means in this game.
  if (blocked(state, state.piece)) state.over = true;
}

const LINE_SCORE = [0, 100, 300, 500, 800];

function lock(state: TetrisState): void {
  for (const [x, y] of cellsOf(state.piece)) {
    if (y >= 0 && y < WELL.height && x >= 0 && x < WELL.width) {
      state.grid[y * WELL.width + x] = colorOf(state.piece.kind);
    }
  }

  const kept: (StyleColor | null)[] = [];
  let cleared = 0;
  for (let y = WELL.height - 1; y >= 0; y--) {
    const row = state.grid.slice(y * WELL.width, (y + 1) * WELL.width);
    if (row.every((cell) => cell != null)) cleared += 1;
    else kept.unshift(...row);
  }
  while (kept.length < WELL.width * WELL.height) kept.unshift(null);
  state.grid = kept;

  if (cleared > 0) {
    state.lines += cleared;
    state.score += (LINE_SCORE[cleared] ?? 0) * state.level;
    state.level = 1 + Math.floor(state.lines / 10);
  }
  spawn(state);
}

/** Gravity, by level. The floor is what stops it becoming unplayable at 20. */
function gravity(level: number): number {
  return Math.max(80, 600 - (level - 1) * 55);
}

function move(state: TetrisState, dx: number, dy: number): boolean {
  const moved = { ...state.piece, x: state.piece.x + dx, y: state.piece.y + dy };
  if (blocked(state, moved)) return false;
  state.piece = moved;
  return true;
}

/**
 * Rotate, and if that does not fit, shove it. Without a kick a piece cannot be
 * turned while it rests against a wall, which is where it usually is.
 */
function rotate(state: TetrisState): void {
  const turned = { ...state.piece, rotation: state.piece.rotation + 1 };
  for (const kick of [0, -1, 1, -2, 2]) {
    const candidate = { ...turned, x: turned.x + kick };
    if (!blocked(state, candidate)) {
      state.piece = candidate;
      return;
    }
  }
}

export const tetris: Game<TetrisState> = {
  id: 'tetris',
  title: 'Tetris',
  blurb: 'Seven shapes, ten columns, no room for hesitation.',
  field: FIELD,
  controls: [
    { keys: 'left right', label: 'move' },
    { keys: 'up', label: 'rotate' },
    { keys: 'down', label: 'drop' },
    { keys: 'space', label: 'slam' },
  ],

  create(rng) {
    const state: TetrisState = {
      grid: Array.from({ length: WELL.width * WELL.height }, () => null),
      piece: { kind: 'T', rotation: 0, x: 4, y: -1 },
      next: KINDS[Math.floor(rng() * KINDS.length)] ?? 'T',
      score: 0,
      lines: 0,
      level: 1,
      over: false,
      elapsed: 0,
      rng,
    };
    spawn(state);
    return state;
  },

  step(state, ms) {
    if (state.over) return;
    state.elapsed += ms;
    const interval = gravity(state.level);
    while (state.elapsed >= interval && !state.over) {
      state.elapsed -= interval;
      if (!move(state, 0, 1)) lock(state);
    }
  },

  key(state, key) {
    if (state.over) return;
    switch (key) {
      case 'left': move(state, -1, 0); break;
      case 'right': move(state, 1, 0); break;
      case 'up': rotate(state); break;
      case 'down':
        // Soft drop resets the clock, or a piece nudged down just as gravity
        // fires falls two rows for one press.
        if (move(state, 0, 1)) { state.score += 1; state.elapsed = 0; }
        break;
      case 'action': {
        let dropped = 0;
        while (move(state, 0, 1)) dropped += 1;
        state.score += dropped * 2;
        lock(state);
        state.elapsed = 0;
        break;
      }
      default: break;
    }
  },

  draw(state, field: FieldPainter) {
    for (let y = 0; y < WELL.height; y++) {
      for (let x = 0; x < WELL.width; x++) {
        const color = state.grid[y * WELL.width + x];
        if (color) field.cell(x, y, 'solid', color);
      }
    }
    for (const [x, y] of cellsOf(state.piece)) {
      if (y >= 0) field.cell(x, y, 'solid', colorOf(state.piece.kind));
    }

    // The well's right-hand wall, and the preview beside it.
    for (let y = 0; y < FIELD.height; y++) field.cell(WELL.width, y, 'wall', 'border');
    field.label(PREVIEW_X, 0, 'NEXT', 'muted');
    const shape = SHAPES[state.next];
    for (const [x, y] of shape?.cells ?? []) {
      field.cell(PREVIEW_X + x, 2 + y, 'solid', colorOf(state.next));
    }
  },

  status(state) {
    return {
      score: state.score,
      stats: [
        { label: 'Lines', value: String(state.lines) },
        { label: 'Level', value: String(state.level) },
      ],
      over: state.over,
      banner: state.over ? 'Game over' : undefined,
    };
  },
};

export const TETRIS_WELL = WELL;
