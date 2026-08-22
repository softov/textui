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
