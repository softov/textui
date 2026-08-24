import { describe, expect, it } from 'vitest';
import { renderApp } from '@textui/testing';
import type { Harness } from '@textui/testing';
import { PANELS } from '../src/panels.js';
import { registerShowcase } from '../src/screen.js';

/**
 * The screen that exists to be a picture.
 *
 * Which makes "did it render" the whole test: a panel that throws or a widget
 * whose props drifted is a hole in the screenshot, and nobody notices a hole in
 * a picture nobody looks at. Every panel in the catalog is mounted here, so a
 * widget that stops accepting what this passes it fails the build.
 *
 * The columns are the other half. Wrapping is the layout this example is a
 * demonstration of, and "three across" is a claim about a number - `--wrap` -
 * against a width, so it is asserted at two widths and one of them is narrow
 * enough to be a single column.
 */

/**
 * Tall, because the grid is sized to its content and the content is the point.
 *
 * Generous enough for thirteen panels stacked in a *single* column, which is
 * what the narrow case is - at 120 the last two fell off the bottom and the
 * test read as two missing panels rather than as a short terminal.
 */
const TALL = 260;

async function open(width: number, wrap = 40): Promise<Harness> {
  const t = await renderApp({
    width,
    height: TALL,
    // Registered the way `main` registers it - the surface is what puts the
    // screen on screen, so a root passed beside it would be testing a path
    // nothing uses.
    onBoot: (app) => { registerShowcase(app, { wrap, fit: true }); },
  });
  // Measured widths arrive a frame late by design, and the panels are sized
  // from them - the first frame is the unwrapped one.
  for (let i = 0; i < 8; i++) await t.settle();
  return t;
}

/** The row a panel's top border is drawn on, and what else is on it. */
function titleRow(t: Harness, title: string): string {
  return t.lines().find((line) => line.includes(`┌ ${title} `)) ?? '';
}

describe('everything on one screen', () => {
  for (const width of [132, 62]) {
    it(`draws every panel at ${width} columns`, async () => {
      const t = await open(width);
      expect(t.errors()).toEqual([]);

      // Not a count - the names, so a panel that silently stopped rendering is
      // named in the failure rather than turning up as 12 instead of 13.
      const missing = PANELS.filter((p) => titleRow(t, p.title) === '').map((p) => p.id);
      expect(missing).toEqual([]);
      await t.unmount();
    });
  }

  it('puts three panels on a line when there is room for three', async () => {
    const t = await open(132);
    // The three that come first, on one row, because 40 goes into 130 three
    // times. This is the whole behaviour `--wrap` controls.
    const row = titleRow(t, 'Controls');
    expect(row).toContain('┌ Text ');
    expect(row).toContain('┌ Choosing ');
    await t.unmount();
  });

  it('falls to one panel a line when there is not', async () => {
    const t = await open(62);
    const row = titleRow(t, 'Controls');
    expect(row).not.toContain('┌ Text ');
    // And no breakpoint said so: the same screen, the same `--wrap`, a
    // narrower terminal.
    expect(titleRow(t, 'Text')).not.toBe('');
    await t.unmount();
  });

  it('takes the column count from --wrap, not from the width', async () => {
    const narrow = await open(132, 40);
    const wide = await open(132, 64);
    // Two across at 64 where there were three at 40, on the same terminal.
    expect(titleRow(narrow, 'Controls')).toContain('┌ Choosing ');
    expect(titleRow(wide, 'Controls')).not.toContain('┌ Choosing ');
    expect(titleRow(wide, 'Controls')).toContain('┌ Text ');
    await narrow.unmount();
    await wide.unmount();
  });

  it('renders one panel on its own when asked for one', async () => {
    const t = await renderApp({
      width: 80,
      height: 40,
      onBoot: (app) => { registerShowcase(app, { wrap: 40, only: 'charts', fit: true }); },
    });
    for (let i = 0; i < 8; i++) await t.settle();

    expect(titleRow(t, 'Charts')).not.toBe('');
    expect(titleRow(t, 'Controls')).toBe('');
    expect(t.hasText(`1 of ${PANELS.length} panels`)).toBe(true);
    await t.unmount();
  });

  it('keeps the last word of a message that wraps inside a panel', async () => {
    // The panels are 40 cells wide, and an `Alert` is a row: an icon beside a
    // column holding the text. The text used to be *measured* against the whole
    // row and laid out in what was left, so a message one cell too long came
    // out a row short and lost its tail off the bottom of the panel.
    const t = await open(132);
    expect(t.hasText('hour.')).toBe(true);
    await t.unmount();
  });

  it('cycles the theme, from the key and from the command', async () => {
    const t = await open(132);
    const first = t.app.theme.id;

    t.press('t');
    await t.settle();
    expect(t.app.theme.id).not.toBe(first);

    // The key is a binding over a command, so the palette reaches the same
    // code - which is the point of registering it as one.
    t.app.commands.execute('showcase.theme');
    await t.settle();
    expect(t.app.theme.id).not.toBe(first);
    await t.unmount();
  });
});
