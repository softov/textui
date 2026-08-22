import type { FieldPainter, Game, Rng } from '../engine.js';
import type { StyleColor } from '@textui/core';

/**
 * Breakout.
 *
 * The one that needs the finer resolution. Bricks and the paddle are laid out
 * in cells, but the ball is drawn as a dot - one column, half a row - so it
 * moves smoothly between the rows the bricks sit on instead of teleporting
 * from one to the next.
 *
 * The ball moves in dot units per millisecond and in small enough steps that
 * it cannot pass through a brick between two frames. A frame is 33ms at the
 * driver's ceiling, and 33ms of unchecked travel is most of the way across the
 * field - which is exactly how a ball ends up inside the wall.
 */

const FIELD = { width: 20, height: 15 };
const DOTS = { width: FIELD.width * 2, height: FIELD.height * 2 };
const PADDLE_ROW = FIELD.height - 1;
const BRICK_ROWS = 4;
const BRICK_TOP = 2;
const ROW_COLORS: StyleColor[] = ['danger', 'warning', 'success', 'info'];
const MAX_STEP = 0.5;

/**
 * The difficulty, as two numbers per level.
 *
 * A level has to be *reachable* before speeding one up means anything: a rack
 * of five rows is ninety bricks, which nobody clears, so the ramp behind it
 * was theoretical and the first level was the whole game. Four rows of
 * sixteen is sixty-four - a rack you finish - and finishing it is what makes
 * the ball faster and the paddle narrower.
 *
 * Level one is deliberately slow. The ball has to be catchable by someone who
 * has never played it, on a terminal that will not say when a key is held, and
 * everything above is a curve from there.
 */
const BASE_SPEED = 0.0125;
const SPEED_PER_LEVEL = 1.12;
const TOP_SPEED = 0.026;

/**
 * Seven cells at first, four by level seven. Two levels at each width, so a
 * rack cleared is either a faster ball or a smaller paddle and never both -
 * one step at a time is a curve, both at once is a cliff.
 */
const PADDLE_WIDTHS = [7, 7, 6, 6, 5, 5, 4];

function speedFor(level: number): number {
  return Math.min(TOP_SPEED, BASE_SPEED * SPEED_PER_LEVEL ** (level - 1));
}

function widthFor(level: number): number {
  return PADDLE_WIDTHS[Math.min(level - 1, PADDLE_WIDTHS.length - 1)] as number;
}

/**
 * The paddle moves on its own, and a key only pushes it.
 *
 * A terminal does not say a key is *held*: it sends one event, waits out the
 * operating system's repeat delay - half a second on most machines - and then
 * sends more. A paddle that moved a cell per event therefore moved one cell,
 * paused for half a second, and then skated; the ball meanwhile moves every
 * frame, and the game is unplayable for the first half second of every rally.
 *
 * So a press is an impulse. It sets a direction and buys `PADDLE_DRIVE`
 * milliseconds of travel, and travel happens in `step` like everything else
 * that moves. Repeats top the drive back up, which turns a held key into
 * continuous motion, and a single tap glides a couple of cells instead of
 * stepping one.
 */
const PADDLE_SPEED = 0.022;
const PADDLE_DRIVE = 140;

export interface BreakoutState {
  /** One entry per cell of the brick block; null once broken. */
  bricks: (StyleColor | null)[];
  /** Cells, and fractional: the paddle moves in time, not in key presses. */
  paddleX: number;
  /** Cells per millisecond, signed. Zero when the drive runs out. */
  paddleVx: number;
  /** Milliseconds of travel left from the last press. */
  drive: number;
  ball: { x: number; y: number; dx: number; dy: number };
  /** True while the ball sits on the paddle waiting to be launched. */
  waiting: boolean;
  lives: number;
  score: number;
  level: number;
  over: boolean;
  rng: Rng;
}

const brickIndex = (x: number, y: number): number => (y - BRICK_TOP) * FIELD.width + x;

/**
 * Where the paddle is, as a whole cell.
 *
 * The one place that rounds. The ball bounces off the paddle a player can see,
 * so the collision and the drawing have to read the same number - a physics
 * paddle half a cell away from the drawn one is a ball that bounces off
 * nothing, once every other rally.
 */
const paddleCell = (state: BreakoutState): number => Math.round(state.paddleX);

/** How wide the paddle is right now. Narrower with every rack cleared. */
const paddleWidth = (state: BreakoutState): number => widthFor(state.level);

function drivePaddle(state: BreakoutState, ms: number): void {
  if (state.drive <= 0) return;
  const dt = Math.min(ms, state.drive);
  state.drive -= dt;
  state.paddleX = Math.max(
    0,
    Math.min(FIELD.width - paddleWidth(state), state.paddleX + state.paddleVx * dt),
  );
  if (state.drive <= 0) state.paddleVx = 0;
}

function rack(): (StyleColor | null)[] {
  const bricks: (StyleColor | null)[] = Array.from(
    { length: BRICK_ROWS * FIELD.width },
    () => null,
  );
  for (let row = 0; row < BRICK_ROWS; row++) {
    for (let x = 2; x < FIELD.width - 2; x++) {
      bricks[row * FIELD.width + x] = ROW_COLORS[row] ?? 'accent';
    }
  }
  return bricks;
}

function park(state: BreakoutState): void {
  state.waiting = true;
  // Clamped here as well as in the drive: a rack cleared makes the paddle
  // narrower, and a wider one may have been resting past where a narrow one
  // can be.
  state.paddleX = Math.max(0, Math.min(FIELD.width - paddleWidth(state), state.paddleX));
  state.ball = {
    x: paddleCell(state) * 2 + paddleWidth(state),
    y: PADDLE_ROW * 2 - 1,
    dx: 0,
    dy: 0,
  };
}

function launch(state: BreakoutState): void {
  if (!state.waiting) return;
  state.waiting = false;
  const speed = speedFor(state.level);
  // Never straight up - a vertical launch is a coin toss the player has no
  // part in - but steep, because the first thing a ball does is come back, and
  // it should come back near where it left.
  state.ball.dx = (state.rng() < 0.5 ? -1 : 1) * speed * 0.5;
  state.ball.dy = -speed;
}

function brickAt(state: BreakoutState, col: number, row: number): number | null {
  const x = Math.floor(col / 2);
  const y = Math.floor(row / 2);
  if (y < BRICK_TOP || y >= BRICK_TOP + BRICK_ROWS) return null;
  if (x < 0 || x >= FIELD.width) return null;
  const index = brickIndex(x, y);
  return state.bricks[index] ? index : null;
}

function hitBrick(state: BreakoutState, index: number): void {
  state.bricks[index] = null;
  state.score += 10 * state.level;
  if (state.bricks.every((brick) => brick == null)) {
    // A cleared rack is a new one, faster. Ending the game on a win would make
    // being good at it the shortest way to stop playing.
    state.level += 1;
    state.bricks = rack();
    park(state);
  }
}

/**
 * One sub-step of travel.
 *
 * Each axis is resolved on its own, which is what makes a corner behave: a
 * ball that clips the end of a brick reverses only the axis it actually
 * crossed, rather than reversing both and coming straight back at itself.
 */
function travel(state: BreakoutState, dt: number): void {
  const ball = state.ball;

  const nextX = ball.x + ball.dx * dt;
  if (nextX < 0 || nextX > DOTS.width - 1) {
    ball.dx = -ball.dx;
  } else {
    const brick = brickAt(state, nextX, ball.y);
    if (brick != null) {
      hitBrick(state, brick);
      ball.dx = -ball.dx;
    } else {
      ball.x = nextX;
    }
  }

  const nextY = ball.y + ball.dy * dt;
  if (nextY < 0) {
    ball.dy = -ball.dy;
  } else if (nextY > DOTS.height - 1) {
    state.lives -= 1;
    if (state.lives <= 0) state.over = true;
    else park(state);
    return;
  } else {
    const brick = brickAt(state, ball.x, nextY);
    if (brick != null) {
      hitBrick(state, brick);
      ball.dy = -ball.dy;
      return;
    }

    const paddleTop = PADDLE_ROW * 2;
    const left = paddleCell(state) * 2;
    const onPaddle = nextY >= paddleTop
      && ball.x >= left
      && ball.x < left + paddleWidth(state) * 2;
    if (onPaddle && ball.dy > 0) {
      // Where it lands on the paddle decides where it goes, which is the whole
      // game: a paddle that only reversed the ball would leave the player with
      // nothing to aim with.
      const offset = (ball.x - left) / (paddleWidth(state) * 2) - 0.5;
      const speed = Math.hypot(ball.dx, ball.dy);
      ball.dx = speed * offset * 1.6;
      ball.dy = -Math.sqrt(Math.max(speed * speed - ball.dx * ball.dx, (speed * 0.4) ** 2));
      ball.y = paddleTop - 1;
      return;
    }
    ball.y = nextY;
  }
}

export const breakout: Game<BreakoutState> = {
  id: 'breakout',
  title: 'Breakout',
  blurb: 'Clear the wall. The paddle is how you aim.',
  field: FIELD,
  floor: 'open',
  controls: [
    { keys: 'left right', label: 'paddle' },
    { keys: 'space', label: 'launch' },
  ],

  create(rng) {
    const state: BreakoutState = {
      bricks: rack(),
      paddleX: Math.floor((FIELD.width - widthFor(1)) / 2),
      paddleVx: 0,
      drive: 0,
      ball: { x: 0, y: 0, dx: 0, dy: 0 },
      waiting: true,
      lives: 3,
      score: 0,
      level: 1,
      over: false,
      rng,
    };
    park(state);
    return state;
  },

  step(state, ms) {
    if (state.over) return;
    // The paddle first, and whatever the ball is doing: it moves while the
    // ball is parked on it, which is how you aim a launch.
    drivePaddle(state, ms);
    if (state.waiting) {
      park(state);
      return;
    }
    // Chopped into pieces small enough that nothing is skipped over: the ball
    // never advances more than half a dot between two collision checks.
    const speed = Math.max(Math.abs(state.ball.dx), Math.abs(state.ball.dy));
    const slice = speed > 0 ? Math.min(ms, MAX_STEP / speed) : ms;
    let remaining = ms;
    while (remaining > 0 && !state.over && !state.waiting) {
      const dt = Math.min(slice, remaining);
      travel(state, dt);
      remaining -= dt;
    }
  },

  key(state, key) {
    if (state.over) return;
    switch (key) {
      // A press does not move the paddle. It says which way, and for how long
      // the paddle keeps going without hearing anything more - which is the
      // only way to cover for a repeat delay nothing here can see.
      case 'left': state.paddleVx = -PADDLE_SPEED; state.drive = PADDLE_DRIVE; break;
      case 'right': state.paddleVx = PADDLE_SPEED; state.drive = PADDLE_DRIVE; break;
      case 'action': case 'up': launch(state); break;
      default: break;
    }
  },

  draw(state, field: FieldPainter) {
    for (let row = 0; row < BRICK_ROWS; row++) {
      for (let x = 0; x < FIELD.width; x++) {
        const color = state.bricks[row * FIELD.width + x];
        if (color) field.cell(x, BRICK_TOP + row, 'solid', color);
      }
    }
    const paddle = paddleCell(state);
    for (let i = 0; i < paddleWidth(state); i++) {
      field.cell(paddle + i, PADDLE_ROW, 'solid', 'accent');
    }
    field.dot(state.ball.x, state.ball.y, 'text');

    if (state.waiting && !state.over) {
      field.label(2, PADDLE_ROW - 3, 'space to launch', 'muted');
    }
  },

  status(state) {
    return {
      score: state.score,
      stats: [
        { label: 'Lives', value: String(Math.max(0, state.lives)) },
        { label: 'Level', value: String(state.level) },
        // How close the next level is. A ramp nobody can see the end of is a
        // ramp nobody is climbing.
        { label: 'Left', value: String(state.bricks.filter((brick) => brick != null).length) },
      ],
      over: state.over,
      banner: state.over ? 'Game over' : undefined,
    };
  },
};
