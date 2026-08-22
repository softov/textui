import { describe, expect, it } from 'vitest';
import type { PaintSurface, Rect, RenderContext } from '@textui/core';
import { createPainter, createRng } from '../src/engine.js';
import { glyphsFor } from '../src/glyphs.js';
import { GAMES, snake, tetris, breakout } from '../src/games/index.js';
import { cellsOf, TETRIS_WELL } from '../src/games/tetris.js';
import type { SnakeState } from '../src/games/snake.js';
import type { TetrisState } from '../src/games/tetris.js';
import type { BreakoutState } from '../src/games/breakout.js';

/**
 * The rules, with no application under them.
 *
 * This is what the contract in `engine.ts` buys: a game is a state machine
 * given milliseconds, so every rule in it can be checked by advancing a number
 * rather than by mounting a screen, pressing keys and reading the frame back.
 * The screen is tested too - in `smoke.test.tsx` - but not for whether a line
 * clears.
 */

// ------------------------------------------------------------------- surface

/** A surface that remembers, so a test can read what a game drew. */
function testSurface(width: number, height: number): PaintSurface & { rows(): string[] } {
  const grid = Array.from({ length: height }, () => Array.from({ length: width }, () => ' '));
  const rect: Rect = { x: 0, y: 0, width, height };
  const surface: PaintSurface & { rows(): string[] } = {
    rect,
    put(x, y, char) {
      const row = grid[y];
      if (row && x >= 0 && x < width) row[x] = char;
    },
    text(x, y, text) {
      [...text].forEach((char, i) => surface.put(x + i, y, char));
      return text.length;
    },
    fill() {},
    cell() {},
    clip() { return surface; },
    rows: () => grid.map((row) => row.join('').replace(/\s+$/, '')),
  };
  return surface;
}

/** Enough of a render context for a painter: colours pass straight through. */
const ctx = { color: (c: unknown) => c } as unknown as RenderContext;

// --------------------------------------------------------------------- snake

describe('snake', () => {
  const start = (): SnakeState => snake.create(createRng(1));

  it('moves one cell per interval, and owes nothing for a late frame', () => {
    const state = start();
    const head = { ...(state.body[0] as { x: number; y: number }) };

    snake.step(state, 140);
    expect(state.body[0]).toEqual({ x: head.x + 1, y: head.y });

    // One frame carrying three intervals is three moves, not one: dropping
    // them would make the snake run slower than the speed it reports.
    snake.step(state, 420);
    expect(state.body[0]).toEqual({ x: head.x + 4, y: head.y });
  });

  it('grows by eating, and the tail follows', () => {
    const state = start();
    const head = state.body[0] as { x: number; y: number };
    state.food = { x: head.x + 1, y: head.y };

    snake.step(state, 140);
    expect(state.score).toBe(10);
    // Two cells of growth, paid out one move at a time.
    snake.step(state, 140);
    snake.step(state, 140);
    expect(state.body).toHaveLength(5);
  });

  it('ends at the wall', () => {
    const state = start();
    snake.step(state, 140 * 40);
    expect(state.over).toBe(true);
    expect(snake.status(state).banner).toBe('Game over');
  });

  it('will not reverse into its own neck', () => {
    const state = start();
    snake.key(state, 'left');
    snake.step(state, 140);
    // Still going right: a reversal is refused rather than queued, or a mashed
    // key would kill you one step later for no visible reason.
    expect(state.dir).toEqual({ x: 1, y: 0 });
  });

  it('queues a second turn instead of dropping it', () => {
    const state = start();
    // Both inside one interval - faster than the snake moves, which is how
    // anyone plays it.
    snake.key(state, 'up');
    snake.key(state, 'left');

    snake.step(state, 140);
    expect(state.dir).toEqual({ x: 0, y: -1 });
    snake.step(state, 140);
    expect(state.dir).toEqual({ x: -1, y: 0 });
  });

  it('follows its own tail into the cell the tail is leaving', () => {
    const state = start();
    // A closed loop, head at the top left, tail at the bottom left. Going down
    // puts the head exactly where the tail is *now* - and the tail moves out
    // of it on the same step. Counting that as a crash is the classic bug: it
    // kills you for a legal move, at full speed, with nothing on screen to say
    // why.
    state.body = [{ x: 4, y: 5 }, { x: 5, y: 5 }, { x: 5, y: 6 }, { x: 4, y: 6 }];
    state.dir = { x: -1, y: 0 };
    state.queued = [];
    state.grow = 0;
    snake.key(state, 'down');
    snake.step(state, 140);

    expect(state.over).toBe(false);
    expect(state.body[0]).toEqual({ x: 4, y: 6 });
  });
});

// -------------------------------------------------------------------- tetris

describe('tetris', () => {
  const start = (): TetrisState => tetris.create(createRng(2));

  it('turns a piece all the way round to where it started', () => {
    const piece = { kind: 'T', rotation: 0, x: 3, y: 5 };
    const before = cellsOf(piece).map(String).sort();
    const after = cellsOf({ ...piece, rotation: 4 }).map(String).sort();
    expect(after).toEqual(before);
  });

  it('falls under gravity', () => {
    const state = start();
    const y = state.piece.y;
    tetris.step(state, 600);
    expect(state.piece.y).toBe(y + 1);
  });

  it('locks on a hard drop and brings the next piece in', () => {
    const state = start();
    const kind = state.piece.kind;
    const next = state.next;

    tetris.key(state, 'action');
    expect(state.piece.kind).toBe(next);
    expect(state.grid.some((cell) => cell != null)).toBe(true);
    // The piece that landed is on the floor, not floating where it was.
    const lowest = state.grid.findIndex((cell) => cell != null);
    expect(Math.floor(lowest / TETRIS_WELL.width)).toBeGreaterThan(TETRIS_WELL.height - 5);
    expect(kind).not.toBe(undefined);
  });

  it('clears a full row and scores it', () => {
    const state = start();
    const bottom = TETRIS_WELL.height - 1;
    for (let x = 0; x < TETRIS_WELL.width; x++) {
      if (x > 1) state.grid[bottom * TETRIS_WELL.width + x] = 'accent';
    }
    // An O piece in the gap: two cells wide, two tall, so it fills the last
    // two columns of the bottom row and leaves two cells above.
    state.piece = { kind: 'O', rotation: 0, x: 0, y: 0 };
    tetris.key(state, 'action');

    expect(state.lines).toBe(1);
    expect(state.score).toBeGreaterThan(0);
    // The row above came down with it, rather than the board keeping a hole.
    expect(state.grid.slice(bottom * TETRIS_WELL.width).filter((c) => c != null)).toHaveLength(2);
  });

  it('kicks a rotation off the wall instead of refusing it', () => {
    const state = start();
    state.piece = { kind: 'I', rotation: 1, x: -1, y: 4 };
    const before = cellsOf(state.piece).length;
    tetris.key(state, 'up');
    expect(cellsOf(state.piece).every(([x]) => x >= 0 && x < TETRIS_WELL.width)).toBe(true);
    expect(cellsOf(state.piece)).toHaveLength(before);
  });

  it('ends when there is no room for what arrives', () => {
    const state = start();
    // The top of the well filled, but with a gap in each row: a full row would
    // be cleared away by the very drop that is supposed to end the game.
    for (let y = 0; y < 4; y++) {
      for (let x = 1; x < TETRIS_WELL.width; x++) {
        state.grid[y * TETRIS_WELL.width + x] = 'accent';
      }
    }
    tetris.key(state, 'action');
    expect(state.over).toBe(true);
    expect(tetris.status(state).banner).toBe('Game over');
  });
});

// ------------------------------------------------------------------ breakout

describe('breakout', () => {
  const start = (): BreakoutState => breakout.create(createRng(3));

  it('holds the ball until it is launched', () => {
    const state = start();
    breakout.step(state, 500);
    expect(state.waiting).toBe(true);
    expect(state.ball.dy).toBe(0);

    breakout.key(state, 'action');
    expect(state.waiting).toBe(false);
    // Upward, and never straight up: a vertical launch is a coin toss the
    // player takes no part in.
    expect(state.ball.dy).toBeLessThan(0);
    expect(state.ball.dx).not.toBe(0);
  });

  it('breaks a brick and scores it', () => {
    const state = start();
    const bricks = state.bricks.filter((b) => b != null).length;
    state.waiting = false;
    // Under the bottom row of bricks, going up.
    state.ball = { x: 10, y: 15, dx: 0, dy: -0.02 };

    breakout.step(state, 250);
    expect(state.bricks.filter((b) => b != null).length).toBe(bricks - 1);
    expect(state.score).toBe(10);
    // And it came back down rather than carrying on through the wall.
    expect(state.ball.dy).toBeGreaterThan(0);
  });

  it('cannot tunnel through the wall in one long frame', () => {
    const state = start();
    state.waiting = false;
    state.ball = { x: 10, y: 15, dx: 0, dy: -0.06 };

    // A frame worth 200ms of travel at a speed that would cross the whole
    // brick block. Without sub-stepping the ball comes out the other side
    // having broken nothing.
    breakout.step(state, 200);
    expect(state.score).toBeGreaterThan(0);
    expect(state.ball.y).toBeGreaterThanOrEqual(0);
  });

  it('loses a life at the floor and parks the ball again', () => {
    const state = start();
    state.waiting = false;
    state.ball = { x: 10, y: 28, dx: 0, dy: 0.05 };

    breakout.step(state, 50);
    expect(state.lives).toBe(2);
    expect(state.waiting).toBe(true);
    expect(state.over).toBe(false);
  });

  it('ends when the last life goes', () => {
    const state = start();
    state.lives = 1;
    state.waiting = false;
    state.ball = { x: 10, y: 28, dx: 0, dy: 0.05 };

    breakout.step(state, 50);
    expect(state.over).toBe(true);
    expect(breakout.status(state).over).toBe(true);
  });

  it('keeps moving after the key event is over', () => {
    const state = start();
    const from = state.paddleX;

    // One event, then silence. A paddle that moved only when a key arrived
    // would be exactly one cell to the left and stay there.
    breakout.key(state, 'left');
    breakout.step(state, 16);
    const after16 = state.paddleX;
    breakout.step(state, 200);

    expect(after16).toBeLessThan(from);
    expect(state.paddleX).toBeLessThan(after16);
    // A tap is worth a few cells, not one and not the whole field.
    expect(from - state.paddleX).toBeGreaterThan(2);
    expect(from - state.paddleX).toBeLessThan(5);

    // And then it stops on its own rather than sliding for ever: the drive is
    // spent, so silence means still.
    const settled = state.paddleX;
    breakout.step(state, 500);
    expect(state.paddleX).toBe(settled);
  });

  it('out-runs the ball, the way a terminal actually sends a held key', () => {
    const state = start();
    state.paddleX = 0;
    breakout.key(state, 'action');
    const ballFrom = state.ball.x;

    // The operating system's repeat delay, then repeats. This is the shape of
    // the input that made the game unplayable: one event, half a second of
    // nothing, then a stream.
    breakout.key(state, 'right');
    for (let ms = 0; ms < 500; ms += 16) breakout.step(state, 16);
    for (let repeat = 0; repeat < 30; repeat++) {
      breakout.key(state, 'right');
      breakout.step(state, 33);
    }

    // Nearly two seconds, of which half a second was silence: the paddle has
    // to have covered more ground than the ball, or there is no catching it.
    const paddleTravel = state.paddleX * 2;
    const ballTravel = Math.abs(state.ball.x - ballFrom);
    expect(paddleTravel).toBeGreaterThan(ballTravel);
    expect(state.paddleX).toBeGreaterThan(10);
  });

  it('stops at the walls rather than sliding past them', () => {
    const state = start();
    for (let i = 0; i < 20; i++) { breakout.key(state, 'left'); breakout.step(state, 100); }
    expect(state.paddleX).toBe(0);

    for (let i = 0; i < 20; i++) { breakout.key(state, 'right'); breakout.step(state, 100); }
    // Twenty cells of field, less the seven the level-one paddle takes up.
    expect(state.paddleX).toBe(20 - 7);
  });

  it('gets harder with every rack: faster ball, narrower paddle', () => {
    const state = start();
    const bricks = state.bricks.filter((b) => b != null).length;
    // A rack has to be finishable for a level to mean anything - four rows of
    // sixteen rather than five of eighteen, which nobody clears.
    expect(bricks).toBe(64);

    // Down to the last brick, in the top row, and the ball on its way up to it.
    state.bricks = state.bricks.map((brick, i) => (i === 5 ? brick : null));
    state.waiting = false;
    state.ball = { x: 10, y: 13, dx: 0, dy: -0.02 };
    const launchSpeed = () => {
      const probe = { ...state, ball: { ...state.ball }, waiting: true } as typeof state;
      breakout.key(probe, 'action');
      return Math.hypot(probe.ball.dx, probe.ball.dy);
    };
    const before = launchSpeed();

    breakout.step(state, 500);

    expect(state.level).toBe(2);
    expect(state.bricks.filter((b) => b != null).length).toBe(64);
    expect(state.waiting).toBe(true);
    expect(launchSpeed()).toBeGreaterThan(before);

    // One thing at a time: level two is a faster ball and the same paddle.
    // Speeding the ball up *and* shrinking the paddle on the same rack is the
    // step that turns a curve into a cliff.
    const reach = (): number => {
      for (let i = 0; i < 25; i++) { breakout.key(state, 'right'); breakout.step(state, 100); }
      return state.paddleX;
    };
    expect(reach()).toBe(20 - 7);

    // Level three is where it narrows - and a narrower paddle can be driven a
    // cell further right before the wall stops it, which is the difference
    // made visible without reaching inside the game for its width.
    state.level = 3;
    expect(reach()).toBe(20 - 6);
  });

  it('carries the parked ball with it, so a launch can be aimed', () => {
    const state = start();
    const from = state.ball.x;
    breakout.key(state, 'right');
    breakout.step(state, 100);

    expect(state.waiting).toBe(true);
    expect(state.ball.x).toBeGreaterThan(from);
  });

  it('sends the ball where the paddle was hit', () => {
    const state = start();
    state.waiting = false;
    state.paddleX = 5;
    // The left-hand end of the paddle sends it left; the right-hand end sends
    // it right. A paddle that only reverses gives the player nothing to aim
    // with.
    state.ball = { x: 11, y: 27, dx: 0.005, dy: 0.02 };
    breakout.step(state, 60);
    expect(state.ball.dx).toBeLessThan(0);

    const other = start();
    other.waiting = false;
    other.paddleX = 5;
    other.ball = { x: 18, y: 27, dx: -0.005, dy: 0.02 };
    breakout.step(other, 60);
    expect(other.ball.dx).toBeGreaterThan(0);
  });
});

// ------------------------------------------------------------------- painter

describe('the painter', () => {
  it('joins two dots in one column into a whole block', () => {
    const painter = createPainter({ width: 2, height: 1 }, glyphsFor('full'));
    painter.dot(0, 0, 'text');
    painter.dot(0, 1, 'text');
    painter.dot(3, 1, 'accent');

    const surface = testSurface(4, 1);
    painter.flush(surface, ctx, 0, 0);
    // Top and bottom lit is one glyph, not two writes fighting over a cell.
    expect(surface.rows()[0]).toBe('█  ▄');
  });

  it('centres a banner in columns, not in cells', () => {
    const painter = createPainter({ width: 5, height: 1 }, glyphsFor('full'));
    painter.centre(0, 'abc', 'text');

    const surface = testSurface(10, 1);
    painter.flush(surface, ctx, 0, 0);
    // Ten columns, three characters: three and a half either side rounds to
    // column 4 - which a cell-based centre could not express at all.
    expect(surface.rows()[0]).toBe('    abc');
  });

  it('draws nothing an ascii terminal cannot draw', () => {
    for (const game of GAMES) {
      const state = game.create(createRng(4));
      const painter = createPainter(game.field, glyphsFor('ascii'));
      game.draw(state, painter);
      painter.centre(0, 'Game over', 'warning');

      const surface = testSurface(game.field.width * 2, game.field.height);
      painter.flush(surface, ctx, 0, 0);
      const offending = surface.rows().join('').split('')
        .filter((c) => (c.codePointAt(0) as number) > 0x7f);
      expect(offending).toEqual([]);
    }
  });

  it('clips what falls outside the field', () => {
    const painter = createPainter({ width: 2, height: 1 }, glyphsFor('full'));
    painter.cell(-1, 0, 'solid', 'text');
    painter.cell(5, 0, 'solid', 'text');
    painter.dot(99, 99, 'text');
    painter.label(0, 4, 'nope', 'text');

    const surface = testSurface(4, 1);
    painter.flush(surface, ctx, 0, 0);
    expect(surface.rows()[0]).toBe('');
  });
});
