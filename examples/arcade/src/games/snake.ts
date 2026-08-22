import type { FieldPainter, Game, GameKey, Rng } from '../engine.js';

/**
 * Snake.
 *
 * The simplest complete loop there is, and the one that shows what the field
 * is: a grid of cells, one segment each, walls that end the run.
 *
 * The turn is queued rather than applied. Two keys inside one step - up then
 * left, faster than the snake moves - would otherwise reverse it into its own
 * neck, which reads as the game killing you for pressing the right keys.
 */

interface Point { x: number; y: number }

export interface SnakeState {
  body: Point[];
  dir: Point;
  queued: Point[];
  food: Point;
  score: number;
  over: boolean;
  grow: number;
  interval: number;
  elapsed: number;
  rng: Rng;
}

const FIELD = { width: 24, height: 16 };
const START_INTERVAL = 140;
const FASTEST = 60;

const DIRECTIONS: Record<Exclude<GameKey, 'action'>, Point> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};

function occupies(body: Point[], x: number, y: number): boolean {
  return body.some((p) => p.x === x && p.y === y);
}

/** Somewhere the snake is not. A random cell retried is fine at this size. */
function placeFood(state: SnakeState): Point {
  for (let attempt = 0; attempt < 200; attempt++) {
    const x = Math.floor(state.rng() * FIELD.width);
    const y = Math.floor(state.rng() * FIELD.height);
    if (!occupies(state.body, x, y)) return { x, y };
  }
  // A field this full is a win in every practical sense, but the loop still
  // has to end somewhere it can point at.
  for (let y = 0; y < FIELD.height; y++) {
    for (let x = 0; x < FIELD.width; x++) if (!occupies(state.body, x, y)) return { x, y };
  }
  return { x: 0, y: 0 };
}

function advance(state: SnakeState): void {
  const next = state.queued.shift();
  if (next) state.dir = next;

  const head = state.body[0];
  if (!head) return;
  const target = { x: head.x + state.dir.x, y: head.y + state.dir.y };

  if (
    target.x < 0 || target.y < 0
    || target.x >= FIELD.width || target.y >= FIELD.height
    // The tail cell is about to be vacated, so moving into it is legal - and
    // treating it as a crash makes a full-speed turn along your own body fail
    // for a reason nothing on screen shows.
    || occupies(state.grow > 0 ? state.body : state.body.slice(0, -1), target.x, target.y)
  ) {
    state.over = true;
    return;
  }

  state.body.unshift(target);
  if (target.x === state.food.x && target.y === state.food.y) {
    state.score += 10;
    state.grow += 2;
    state.interval = Math.max(FASTEST, state.interval - 4);
    state.food = placeFood(state);
  }
  if (state.grow > 0) state.grow -= 1;
  else state.body.pop();
}

export const snake: Game<SnakeState> = {
  id: 'snake',
  title: 'Snake',
  blurb: 'Eat, grow, do not turn into yourself.',
  field: FIELD,
  controls: [
    { keys: 'arrows', label: 'turn' },
  ],

  create(rng) {
    const middle = Math.floor(FIELD.height / 2);
    const state: SnakeState = {
      body: [{ x: 6, y: middle }, { x: 5, y: middle }, { x: 4, y: middle }],
      dir: DIRECTIONS.right,
      queued: [],
      food: { x: 0, y: 0 },
      score: 0,
      over: false,
      grow: 0,
      interval: START_INTERVAL,
      elapsed: 0,
      rng,
    };
    state.food = placeFood(state);
    return state;
  },

  step(state, ms) {
    if (state.over) return;
    state.elapsed += ms;
    // A while loop rather than one step per tick: a frame that arrives late
    // owes the game two moves, and dropping them makes the snake stutter
    // instead of running at the speed it says it is running at.
    while (state.elapsed >= state.interval && !state.over) {
      state.elapsed -= state.interval;
      advance(state);
    }
  },

  key(state, key) {
    if (key === 'action' || state.over) return;
    const wanted = DIRECTIONS[key];
    const last = state.queued[state.queued.length - 1] ?? state.dir;
    // Not backwards, and not a repeat: a queue full of the direction it is
    // already going in delays the turn that comes after it.
    if (wanted.x === -last.x && wanted.y === -last.y) return;
    if (wanted.x === last.x && wanted.y === last.y) return;
    if (state.queued.length < 2) state.queued.push(wanted);
  },

  draw(state, field: FieldPainter) {
    field.cell(state.food.x, state.food.y, 'food', 'warning');
    state.body.forEach((segment, i) => {
      field.cell(segment.x, segment.y, i === 0 ? 'solid' : 'soft', i === 0 ? 'success' : 'primary');
    });
  },

  status(state) {
    return {
      score: state.score,
      stats: [
        { label: 'Length', value: String(state.body.length) },
        { label: 'Speed', value: `${Math.round(1000 / state.interval)}/s` },
      ],
      over: state.over,
      banner: state.over ? 'Game over' : undefined,
    };
  },
};
