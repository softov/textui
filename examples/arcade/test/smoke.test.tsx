import { describe, expect, it } from 'vitest';
import { renderApp } from '@textui/testing';
import type { Harness } from '@textui/testing';
import { registerArcade } from '../src/app.js';
import { GENERATION, PAUSED, SCORES, SEED } from '../src/data.js';

/**
 * The arcade, mounted.
 *
 * What is checked here is the screen rather than the rules - the rules are
 * checked in `games.test.ts`, without an application under them. So: that the
 * loop runs off the shared clock, that pausing stops it, that Ctrl+C means two
 * different things in two places, and that a run that ends leaves its score
 * behind. Everything a person would press goes in as bytes, because a key that
 * works against a synthesised event and not against a terminal works nowhere.
 */

/**
 * Two sizes, both of which fit every game.
 *
 * The bigger one has room to spare; the smaller is two cells over what the
 * tallest game asks for, which is where a layout that only works with slack
 * comes apart. What happens when it does *not* fit is its own test, further
 * down - it is a screen, not a failure.
 */
const SIZES = [
  { width: 110, height: 34 },
  { width: 84, height: 28 },
];

async function open(
  size = SIZES[0] as { width: number; height: number },
  options: { onQuit?(): void; capabilities?: { unicode: 'ascii'; wideChars: false } } = {},
): Promise<Harness> {
  const t = await renderApp({
    ...size,
    shell: 'plain',
    theme: 'console',
    ...(options.capabilities ? { capabilities: options.capabilities } : {}),
    onBoot: (app) => {
      registerArcade(app, options.onQuit ? { onQuit: options.onQuit } : {});
      // The same game every run. Without it the first tick of every test is a
      // different board and a failure is not reproducible.
      app.store.set(SEED, 12345);
    },
  });
  for (let i = 0; i < 8; i++) await t.settle();
  return t;
}

async function play(t: Harness, gameId: string): Promise<void> {
  await t.app.execute('arcade.play', { gameId });
  for (let i = 0; i < 8; i++) await t.settle();
}

/** The rows the field is drawn on, so an assertion cannot pass on the chrome. */
function fieldRows(t: Harness): string[] {
  return t.lines().filter((line) => /[█▒◆▓▄▀#:*|]/.test(line));
}

describe.each(SIZES.map((s) => [`${s.width}x${s.height}`, s] as const))('the cabinet at %s', (_name, size) => {
  it('opens on the list of games', async () => {
    const t = await open(size);
    expect(t.app.screens.current()?.id).toBe('arcade.cabinet');
    expect(t.hasText('Snake')).toBe(true);
    expect(t.hasText('Tetris')).toBe(true);
    expect(t.hasText('Breakout')).toBe(true);
    await t.unmount();
  });

  it('draws every row inside the frame it was given', async () => {
    const t = await open(size);
    expect(t.lines().every((line) => line.length <= size.width)).toBe(true);
    await t.unmount();
  });

  it('plays each game inside its frame', async () => {
    for (const id of ['snake', 'tetris', 'breakout']) {
      const t = await open(size);
      await play(t, id);
      expect(fieldRows(t).length).toBeGreaterThan(0);
      expect(t.lines().every((line) => line.length <= size.width)).toBe(true);
      await t.unmount();
    }
  });
});

describe('starting a game', () => {
  it('is one command, however it was asked for', async () => {
    const t = await open();
    // The list activates the command rather than pushing a screen, so enter
    // and the palette entry cannot drift apart.
    t.press('enter');
    for (let i = 0; i < 6; i++) await t.settle();

    expect(t.app.screens.current()?.id).toBe('arcade.play');
    expect(t.app.screens.current()?.params?.gameId).toBe('snake');
    await t.unmount();
  });

  it('starts a fresh run every time it is entered', async () => {
    const t = await open();
    await play(t, 'snake');
    const first = t.store.get<number>(GENERATION);

    t.feed('\x03');
    for (let i = 0; i < 6; i++) await t.settle();
    t.press('enter');
    for (let i = 0; i < 6; i++) await t.settle();
    await play(t, 'snake');

    expect(t.store.get<number>(GENERATION)).toBeGreaterThan(first as number);
    await t.unmount();
  });
});

describe('the loop', () => {
  it('runs off the shared clock', async () => {
    const t = await open();
    await play(t, 'snake');
    const before = fieldRows(t).join('\n');

    // A whole second of game time, delivered the way the driver delivers it.
    t.advance(1000);
    for (let i = 0; i < 4; i++) await t.settle();

    expect(fieldRows(t).join('\n')).not.toBe(before);
    await t.unmount();
  });

  it('stops while it is paused, and starts again', async () => {
    const t = await open();
    await play(t, 'snake');

    t.feed('p');
    for (let i = 0; i < 4; i++) await t.settle();
    expect(t.store.get<boolean>(PAUSED)).toBe(true);
    expect(t.hasText('Paused')).toBe(true);

    const frozen = fieldRows(t).join('\n');
    t.advance(1000);
    for (let i = 0; i < 4; i++) await t.settle();
    // Not "the snake is where it was": the whole field, because a paused game
    // that keeps a timer somewhere would move something.
    expect(fieldRows(t).join('\n')).toBe(frozen);

    t.feed('p');
    t.advance(500);
    for (let i = 0; i < 4; i++) await t.settle();
    expect(t.store.get<boolean>(PAUSED)).toBe(false);
    expect(fieldRows(t).join('\n')).not.toBe(frozen);
    await t.unmount();
  });

  it('plays the same game twice from the same seed', async () => {
    const first = await open();
    await play(first, 'tetris');
    first.advance(2000);
    for (let i = 0; i < 4; i++) await first.settle();
    const one = fieldRows(first).join('\n');
    await first.unmount();

    const second = await open();
    await play(second, 'tetris');
    second.advance(2000);
    for (let i = 0; i < 4; i++) await second.settle();
    expect(fieldRows(second).join('\n')).toBe(one);
    await second.unmount();
  });
});

/**
 * Ctrl+C, which is the key this example exists to be careful about.
 *
 * In raw mode it is a key event and not a signal, so it can be bound - and it
 * is bound twice, to two commands, under two `when` clauses. Nothing asks
 * which screen it is on.
 */
describe('ctrl+c', () => {
  it('asks before leaving a game, and stays when the answer is no', async () => {
    const t = await open();
    await play(t, 'snake');

    t.feed('\x03');
    for (let i = 0; i < 6; i++) await t.settle();
    expect(t.hasText('Leave game')).toBe(true);
    // Asking over a game that is still running is a question that answers
    // itself while you read it.
    expect(t.store.get<boolean>(PAUSED)).toBe(true);

    t.press('escape');
    for (let i = 0; i < 6; i++) await t.settle();
    expect(t.app.screens.current()?.id).toBe('arcade.play');
    expect(t.store.get<boolean>(PAUSED)).toBe(false);
    await t.unmount();
  });

  it('goes back to the cabinet when the answer is yes', async () => {
    const t = await open();
    await play(t, 'snake');

    t.feed('\x03');
    for (let i = 0; i < 6; i++) await t.settle();
    t.press('enter');
    for (let i = 0; i < 8; i++) await t.settle();

    expect(t.app.screens.current()?.id).toBe('arcade.cabinet');
    expect(t.app.layers.entries()).toHaveLength(0);
    await t.unmount();
  });

  it('quits from the cabinet, where there is nothing to leave', async () => {
    let quit = 0;
    const t = await open(SIZES[0], { onQuit: () => { quit += 1; } });

    t.feed('\x03');
    for (let i = 0; i < 6; i++) await t.settle();
    expect(quit).toBe(1);
    // And no dialog: there is no game to be asked about.
    expect(t.app.layers.entries()).toHaveLength(0);
    await t.unmount();
  });

  it('does not quit from inside a game', async () => {
    let quit = 0;
    const t = await open(SIZES[0], { onQuit: () => { quit += 1; } });
    await play(t, 'snake');

    t.feed('\x03');
    for (let i = 0; i < 6; i++) await t.settle();
    expect(quit).toBe(0);
    await t.unmount();
  });
});

describe('a run that ends', () => {
  /** Straight into the wall: the snake starts moving right and never turns. */
  const runIntoTheWall = async (t: Harness): Promise<void> => {
    await play(t, 'snake');
    t.advance(4000);
    for (let i = 0; i < 6; i++) await t.settle();
  };

  it('says so on the field', async () => {
    const t = await open();
    await runIntoTheWall(t);
    expect(t.hasText('Game over')).toBe(true);
    await t.unmount();
  });

  it('keeps a score worth keeping', async () => {
    const t = await open();
    await play(t, 'tetris');

    // Slammed down, over and over, until the well is full. Gravity alone
    // would end the game too, but with nothing to show for it: a piece that
    // is merely dropped on scores nothing, so a run that ends at zero would
    // prove only that nothing is recorded when there is nothing to record.
    for (let i = 0; i < 80 && !t.hasText('Game over'); i++) {
      t.feed(' ');
      for (let j = 0; j < 2; j++) await t.settle();
    }
    expect(t.hasText('Game over')).toBe(true);

    const scores = t.store.get<Record<string, number>>(SCORES);
    expect(scores?.tetris).toBeGreaterThan(0);

    // And once, not once per frame: the run is over and the ticker is still
    // ticking, so a write on every tick would be invisible here and obvious
    // in a profiler.
    const recorded = scores?.tetris as number;
    t.advance(5000);
    for (let i = 0; i < 4; i++) await t.settle();
    expect(t.store.get<Record<string, number>>(SCORES)?.tetris).toBe(recorded);
    await t.unmount();
  });

  it('turns the game keys into "again"', async () => {
    const t = await open();
    await runIntoTheWall(t);
    const generation = t.store.get<number>(GENERATION) as number;

    t.press('left');
    for (let i = 0; i < 6; i++) await t.settle();
    expect(t.store.get<number>(GENERATION)).toBe(generation + 1);
    expect(t.hasText('Game over')).toBe(false);
    await t.unmount();
  });

  it('shows the best score back in the cabinet', async () => {
    const t = await open();
    t.app.store.set(SCORES, { snake: 240 });
    for (let i = 0; i < 4; i++) await t.settle();

    expect(t.hasText('best 240')).toBe(true);
    await t.unmount();
  });
});

describe('the room it needs', () => {
  it('says so rather than drawing half a field', async () => {
    const t = await open();
    await play(t, 'tetris');
    expect(fieldRows(t).length).toBeGreaterThan(0);

    t.resize(50, 14);
    for (let i = 0; i < 8; i++) await t.settle();

    expect(t.hasText('Not enough room')).toBe(true);
    expect(t.lines().every((line) => line.length <= 50)).toBe(true);
    await t.unmount();
  });

  it('picks the game back up when the room comes back', async () => {
    const t = await open();
    await play(t, 'snake');
    t.resize(40, 12);
    for (let i = 0; i < 8; i++) await t.settle();
    expect(t.hasText('Not enough room')).toBe(true);

    t.resize(100, 30);
    for (let i = 0; i < 8; i++) await t.settle();
    expect(t.hasText('Not enough room')).toBe(false);
    expect(fieldRows(t).length).toBeGreaterThan(0);
    await t.unmount();
  });
});

describe('on a terminal that can only do ASCII', () => {
  it('draws nothing that terminal cannot draw', async () => {
    for (const id of ['snake', 'tetris', 'breakout']) {
      const t = await open(SIZES[0], { capabilities: { unicode: 'ascii', wideChars: false } });
      await play(t, id);
      t.advance(500);
      for (let i = 0; i < 4; i++) await t.settle();

      const offending = [...new Set([...t.text()].filter((c) => (c.codePointAt(0) as number) > 0x7f))];
      expect(offending).toEqual([]);
      expect(fieldRows(t).length).toBeGreaterThan(0);
      await t.unmount();
    }
  });
});
