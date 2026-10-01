import { describe, expect, it } from 'vitest';

/**
 * The playground page and the `--tile` argument it reads.
 *
 * The component's own contract is tested with the component, in
 * `packages/testing`; this is the half that is about the page: that each tab
 * draws a different amount, that the caption reads as JSX, and that a tile
 * handed in on the command line is the tile that gets drawn.
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
    // Mounting the page, settling twice after each of two tab clicks, and
    // reading the frame back - five seconds is the default and this is past it
    // on a loaded machine, which is a flake rather than a finding.
  }, 20000);
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
