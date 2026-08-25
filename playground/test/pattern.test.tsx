import { describe, expect, it } from 'vitest';
import { render } from '@textui/testing';
import { h } from '@textui/core';
import { Pattern } from '../src/components/pattern.js';

/**
 * The pattern's contract, which is four rules and a paint order.
 *
 * All four repeat rules are boundaries - unset, zero, negative, and a count
 * larger than the room - and a component whose whole job is "how many times"
 * is one where only the boundaries are worth asserting.
 */

const TILE = ['ab', 'cd'];

/** The frame, with the trailing blank lines dropped. */
async function paint(node: unknown, width = 8, height = 5): Promise<string[]> {
  const t = await render(node as never, { width, height });
  await t.settle();
  const lines = t.lines().map((l) => l.replace(/\s+$/, ''));
  await t.unmount();
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

const box = (props: Record<string, unknown>) =>
  h('box', { width: 8, height: 4 }, h(Pattern, { tile: TILE, flex: 1, ...props }));

describe('Pattern repeats', () => {
  it('draws the tile once when a count is unset', async () => {
    expect(await paint(box({}))).toEqual(['ab', 'cd']);
  });

  it('treats zero as unset rather than as nothing', async () => {
    expect(await paint(box({ x: 0, y: 0 }))).toEqual(['ab', 'cd']);
  });

  it('fills the box on -1', async () => {
    expect(await paint(box({ x: -1, y: -1 }))).toEqual([
      'abababab', 'cdcdcdcd', 'abababab', 'cdcdcdcd',
    ]);
  });

  it('repeats one axis without the other', async () => {
    expect(await paint(box({ x: -1 }))).toEqual(['abababab', 'cdcdcdcd']);
    expect(await paint(box({ y: -1 }))).toEqual(['ab', 'cd', 'ab', 'cd']);
  });

  it('draws a positive count exactly', async () => {
    expect(await paint(box({ x: 2 }))).toEqual(['abab', 'cdcd']);
  });

  it('clips a count the box has no room for', async () => {
    // Nine copies asked for, four cells' worth of room.
    expect(await paint(box({ x: 9 }))).toEqual(['abababab', 'cdcdcdcd']);
  });

  it('stops at a limit before it stops at the box', async () => {
    expect(await paint(box({ x: -1, y: -1, limit: { width: 4, height: 2 } })))
      .toEqual(['abab', 'cdcd']);
  });
});

describe('Pattern layering', () => {
  const content = h('text', { content: 'XXXX' });

  it('puts the tile under the children as a background', async () => {
    const lines = await paint(
      h('box', { width: 8, height: 2 },
        h(Pattern, { tile: TILE, x: -1, y: -1, asBackground: true, flex: 1 }, content)),
    );
    // The text wins its own cells; the tile shows either side of it.
    expect(lines[0]).toBe('XXXXabab');
  });

  it('puts the tile over the children as an overlay', async () => {
    const lines = await paint(
      h('box', { width: 8, height: 2 },
        h(Pattern, { tile: TILE, x: -1, y: -1, asOverlay: true, transparent: null, flex: 1 }, content)),
    );
    // Same tree, same content, opposite result.
    expect(lines[0]).toBe('abababab');
  });

  it("lets the children show through the tile's transparent cells", async () => {
    const lines = await paint(
      h('box', { width: 8, height: 2 },
        h(Pattern, { tile: ['a ', ' a'], x: -1, y: -1, asOverlay: true, transparent: ' ', flex: 1 },
          content)),
    );
    // Overlaid, but only where the tile has ink. Columns 0/2/4/6 are the
    // tile; 1 and 3 are the text showing through; 5 and 7 are past the text,
    // so they show the empty box rather than either.
    expect(lines[0]).toBe('aXaXa a');
  });
});

/**
 * The playground itself.
 *
 * One page per rule only helps if the pages actually differ, so this walks
 * two of them and checks the pattern changed rather than only the caption.
 */
describe('the pattern playground', () => {
  it('draws a different pattern on each page', async () => {
    const { renderApp } = await import('@textui/testing');
    const { findPlayground, setupPlayground } = await import('../src/registry.js');
    const page = findPlayground('pattern');
    if (!page) throw new Error('no pattern playground');

    const t = await renderApp({
      width: 84,
      height: 24,
      shell: 'plain',
      onBoot: (app) => {
        setupPlayground(app, page);
        app.open({ surface: 'main', key: 'pattern', target: page.node() });
      },
    });
    await t.settle();

    // Once: a single tile, so exactly one line carries any of it.
    const tiled = () => t.lines().filter((line) => line.includes('▘▗')).length;
    expect(tiled()).toBe(1);
    expect(t.hasText('<Pattern tile={…} />')).toBe(true);

    t.clickOn(t.getByRole('tab', { name: 'Fill' }));
    await t.settle();
    await t.settle();

    expect(tiled()).toBeGreaterThan(1);
    expect(t.hasText('<Pattern tile={…} x={-1} y={-1} />')).toBe(true);

    // The generated caption reads as JSX rather than as JSON.
    t.clickOn(t.getByRole('tab', { name: 'Limit' }));
    await t.settle();
    await t.settle();
    expect(t.hasText('limit={{ width: 24, height: 6 }}')).toBe(true);

    await t.unmount();
  });
});

/**
 * A tile handed in on the command line.
 *
 * The runner reads the file and leaves it in the store; this is the other half
 * of that, and the half that decides whether `--tile` does anything at all.
 */
describe('a supplied tile', () => {
  async function open(tile?: unknown) {
    const { renderApp } = await import('@textui/testing');
    const { findPlayground, setupPlayground } = await import('../src/registry.js');
    const { TILE_PATH } = await import('../src/tile.js');
    const page = findPlayground('pattern');
    if (!page) throw new Error('no pattern playground');

    const t = await renderApp({
      width: 84,
      height: 26,
      shell: 'plain',
      onBoot: (app) => {
        setupPlayground(app, page);
        if (tile !== undefined) app.store.set(TILE_PATH as never, tile);
        app.open({ surface: 'main', key: 'pattern', target: page.node() });
      },
    });
    await t.settle();
    return t;
  }

  it('replaces the tile every page would have drawn', async () => {
    const t = await open({ rows: ['@%', '%@'], ascii: ['@%', '%@'], source: 'mine.txt' });

    expect(t.hasText('@%')).toBe(true);
    expect(t.hasText('▘▗')).toBe(false);
    // Named on screen, so a wrong file is obvious rather than puzzling.
    expect(t.hasText('tiled from mine.txt')).toBe(true);

    // Still the same nine rules: Fill covers the box with whatever it is given.
    t.clickOn(t.getByRole('tab', { name: 'Fill' }));
    await t.settle();
    await t.settle();
    expect(t.lines().filter((line) => line.includes('@%')).length).toBeGreaterThan(1);
    await t.unmount();
  });

  it('falls back to the built-in tile when none was given', async () => {
    const t = await open();
    expect(t.hasText('▘▗')).toBe(true);
    expect(t.hasText('a tile, repeated')).toBe(true);
    await t.unmount();
  });
});

/**
 * Spacing and deviation, which are both about the step from one copy to the
 * next rather than about the tile.
 *
 * A ten-wide tile of digits makes an offset readable straight off the row,
 * which is the only reason these read as assertions rather than as riddles.
 */
describe('Pattern spaces its copies', () => {
  const TILE = ['0123456789'];

  /** One row of a full-width pattern, with the gaps left visible. */
  async function row(props: Record<string, unknown>, width = 46): Promise<string> {
    const t = await render(
      h('box', { width, height: 1 },
        h(Pattern, { tile: TILE, flex: 1, x: -1, transparent: null, ...props })) as never,
      { width, height: 1 },
    );
    await t.settle();
    const line = t.line(0);
    await t.unmount();
    return line;
  }

  /** Where each copy starts, read back off the row. */
  const starts = (line: string): number[] =>
    [...line].flatMap((c, i) => (c === '0' ? [i] : []));

  const steps = (line: string): number[] =>
    starts(line).slice(1).map((at, i) => at - (starts(line)[i] as number));

  it('is flush when neither is given', async () => {
    expect(steps(await row({}))).toEqual([10, 10, 10, 10]);
  });

  it('adds the spacing to every step', async () => {
    // Ten wide plus five of air: the second copy starts at 15, not at 10.
    expect(steps(await row({ spacing: { x: 5 } }))).toEqual([15, 15, 15]);
  });

  it('treats a deviation of zero as no deviation at all', async () => {
    // The default has to be the old behaviour exactly, or every pattern
    // already drawn moves the day this prop is added.
    expect(await row({ jitter: { x: 0 } })).toBe(await row({}));
  });

  it('adds up to the deviation, and no more', async () => {
    const out = steps(await row({ jitter: { x: 10 }, seed: 2 }));
    // A limit, not a factor: never closer than flush and never more than ten
    // further on, with every step dealt separately.
    for (const step of out) {
      expect(step).toBeGreaterThanOrEqual(10);
      expect(step).toBeLessThanOrEqual(20);
    }
    expect(new Set(out).size).toBeGreaterThan(1);
  });

  it('stacks on the spacing rather than replacing it', async () => {
    const out = steps(await row({ jitter: { x: 5 }, spacing: { x: 5 }, seed: 2 }));
    // Spacing is the air you always want; the deviation is how much more of
    // it is left to chance. Ten plus four, plus nought to five.
    for (const step of out) {
      expect(step).toBeGreaterThanOrEqual(15);
      expect(step).toBeLessThanOrEqual(20);
    }
  });

  it('deals the same pattern for the same seed, and a different one otherwise', async () => {
    // A pattern re-renders whenever its box changes. One that reached for
    // `Math.random()` would crawl.
    expect(await row({ jitter: { x: 10 }, seed: 7 }))
      .toBe(await row({ jitter: { x: 10 }, seed: 7 }));
    expect(await row({ jitter: { x: 10 }, seed: 7 }))
      .not.toBe(await row({ jitter: { x: 10 }, seed: 8 }));
  });

  /**
   * The case a sparse tile is always in.
   *
   * A big tile with two marks on it is somebody scattering by hand, and it is
   * as wide as the box - so there is no second copy, no step, and nothing for
   * a step's deviation to act on. Every seed dealt the same picture, which is
   * the opposite of what a seed is for.
   */
  it('moves a tile that only fits once, by starting the walk earlier', async () => {
    const wide = ['   .' + ' '.repeat(38)];
    const at = async (seed: number): Promise<string> => (await row(
      { tile: wide, jitter: { x: 25 }, seed, transparent: ' ' },
      46,
    )).indexOf('.').toString();

    // Three different seeds, three different places for the one mark there is.
    expect(new Set([await at(1), await at(2), await at(3)]).size).toBeGreaterThan(1);
  });

  it('leaves the origin alone when there is no deviation', async () => {
    // The phase is part of the deviation, not a thing of its own: without one
    // the first copy is at zero, which is where every pattern already drawn
    // expects it.
    const flush = await row({ spacing: { x: 5 } });
    expect(flush.startsWith('0123456789')).toBe(true);
  });

  it('leaves the origin alone for a stated number of copies', async () => {
    // `x: 2` is "put two here", not "fill this". Sliding those off the left
    // would be answering a different question.
    const two = await row({ x: 2, jitter: { x: 10 }, seed: 5 });
    expect(two.startsWith('0123456789')).toBe(true);
  });

  it('deviates down the box as well as across it', async () => {
    const t = await render(
      h('box', { width: 6, height: 9 },
        h(Pattern, { tile: ['ab'], flex: 1, x: -1, y: -1, jitter: { y: 2 }, seed: 3 })) as never,
      { width: 6, height: 9 },
    );
    await t.settle();
    const filled = t.lines().filter((l) => l.includes('a'));
    await t.unmount();
    // Fewer rows than a flush pattern would have drawn, because some of them
    // went to air.
    expect(filled.length).toBeLessThan(9);
    expect(filled.length).toBeGreaterThan(0);
  });
});
