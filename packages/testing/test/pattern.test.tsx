import { describe, expect, it } from 'vitest';
import { render } from '@textui/testing';
import { h } from '@textui/core';
import { Pattern } from '@textui/widgets';

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

/**
 * An ink, which is the one thing the tile cannot say for itself.
 *
 * The coordinates an ink is handed are the pattern's own box, not one copy of
 * its tile - so a ramp runs across the whole texture, and the second copy of a
 * tile is not the colour of the first.
 */
describe('Pattern ink', () => {
  /** Either shape a colour arrives in, as one comparable hex string. */
  const hex = (c: unknown): string => {
    if (typeof c === 'string') return c;
    if (c && typeof c === 'object' && 'rgb' in c) {
      return `#${(c as { rgb: number[] }).rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
    }
    return String(c);
  };

  /** Every cell's foreground, row by row. */
  const colours = async (
    props: Record<string, unknown>,
    outer: Record<string, unknown> = {},
    width = 8,
    height = 4,
  ): Promise<string[][]> => {
    const t = await render(
      h('box', { width, height, ...outer }, h(Pattern, { tile: 'x', x: -1, y: -1, flex: 1, ...props })),
      { width, height, theme: 'dark' },
    );
    await t.settle();
    const buffer = t.app.buffer();
    const out = Array.from({ length: height }, (_, y) =>
      Array.from({ length: width }, (_, x) => hex(buffer.get(x, y)?.fg)));
    await t.unmount();
    return out;
  };

  it('runs the ramp across the whole box, not one tile', async () => {
    const grid = await colours({ tile: 'xs', ink: { gradient: ['#ff0000', '#0000ff'] } });
    const row = grid[0] as string[];
    expect(row[0]).toBe('#ff0000');
    expect(row[7]).toBe('#0000ff');
    // Two columns of a two-wide tile are two colours: the ramp is the box's.
    expect(row[0]).not.toBe(row[2]);
  });

  it('takes the fg the box was given when there is no ink', async () => {
    const t = await render(
      h('box', { width: 8, height: 4 }, h(Pattern, { tile: 'x', x: -1, y: -1, fg: 'accent', flex: 1 })),
      { width: 8, height: 4, theme: 'dark' },
    );
    await t.settle();
    expect(hex(t.app.buffer().get(3, 2)?.fg)).toBe(hex(t.app.theme.colors.accent));
    await t.unmount();
  });

  it('leaves a transparent cell alone, ink or no ink', async () => {
    // The same tile twice: once with the default `transparent` space, once
    // with `null` so every cell is the tile's. The letter is inked in both;
    // the space is only inked in the second, which is what "left alone" means.
    const ramp = { gradient: ['#ff0000', '#0000ff'] };
    const skipped = await colours({ tile: 'x ', ink: ramp });
    const opaque = await colours({ tile: 'x ', transparent: null, ink: ramp });

    expect((skipped[0] as string[])[0]).toBe('#ff0000');
    expect((opaque[0] as string[])[0]).toBe('#ff0000');
    expect((skipped[0] as string[])[1]).not.toBe((opaque[0] as string[])[1]);
  });
});
