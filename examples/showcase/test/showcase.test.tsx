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

/** How many panel frames begin on a line. */
const framesOn = (row: string): number => (row.match(/┌ /g) ?? []).length;

/**
 * The panels that draw a frame.
 *
 * A pure panel - `isPure` - is content and nothing else: no border, no title,
 * no row for `titleRow` to find. There is one, and it is the banner, so the
 * check for "every panel drew" is about the ones that have a frame to look for
 * and the pure one is asserted on its own below.
 */
const FRAMED = PANELS.filter((p) => p.isPure !== true);

describe('everything on one screen', () => {
  for (const width of [132, 62]) {
    it(`draws every panel at ${width} columns`, async () => {
      const t = await open(width);
      expect(t.errors()).toEqual([]);

      // Not a count - the names, so a panel that silently stopped rendering is
      // named in the failure rather than turning up as 12 instead of 13.
      const missing = FRAMED.filter((p) => titleRow(t, p.title) === '').map((p) => p.id);
      expect(missing).toEqual([]);
      await t.unmount();
    });
  }

  it('puts three cells on a line when there is room for three', async () => {
    const t = await open(132);
    // Three into 130, because 40 goes into it three times. The first of them is
    // the banner, which draws no frame, so the two beside it are the first two
    // framed panels. This is the whole behaviour `--wrap` controls.
    const row = titleRow(t, 'Controls');
    // The pure piece is the first cell and has no frame, so the line starts
    // with its content rather than with a border, and two framed panels sit
    // beside it: three cells into 130.
    expect(row.startsWith('┌')).toBe(false);
    expect(row).toContain('┌ Text ');
    expect(row).not.toContain('┌ Choosing ');
    expect(framesOn(row)).toBe(2);
    await t.unmount();
  });

  it('draws a pure panel as content and nothing else', async () => {
    const t = await renderApp({
      width: 140,
      height: 40,
      onBoot: (app) => { registerShowcase(app, { wrap: 40, only: 'textui', fit: true }); },
    });
    for (let i = 0; i < 8; i++) await t.settle();

    const lines = t.lines();
    const drawn = lines.filter((line) => line.trim() !== '');
    // The words are drawn in a font rather than written, so the sentence is not
    // in the frame - and something is, on more than one row, which is what
    // "drew its content" means whatever font it happens to be in this week.
    expect(t.hasText('Text Terminal User Interface')).toBe(false);
    expect(drawn.length).toBeGreaterThan(3);
    // And no panel was drawn around it: not a border, not a title.
    expect(lines.join('\n')).not.toContain('┌');
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
    // Two framed panels beside the banner at 40, one at 64, on the same
    // terminal: the count is the number, not the width.
    expect(framesOn(titleRow(narrow, 'Controls'))).toBe(2);
    expect(framesOn(titleRow(wide, 'Controls'))).toBe(1);
    expect(titleRow(wide, 'Text')).not.toBe('');
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

  it('scrolls, and says how far down it is', async () => {
    // The footer offered "↑ ↓ scroll" over a row with `overflowY` on it, which
    // scrolls nothing: a box that overflows is not a viewport - somebody has
    // to own the offset, take the keys and draw the bar. At this size most of
    // the grid is below the fold and none of it could be reached.
    const t = await renderApp({
      width: 139,
      height: 35,
      onBoot: (app) => { registerShowcase(app, { wrap: 40 }); },
    });
    for (let i = 0; i < 8; i++) await t.settle();

    // The rightmost column is the scrollbar: a thumb over a track, and where
    // the thumb is is the answer to "how far down am I".
    const bar = (): string => t.lines().map((line) => line.slice(-1)).join('');
    const first = t.lines()[3];
    expect(bar()).toContain('█');
    expect(bar().indexOf('█')).toBe(1);

    t.press('pagedown');
    for (let i = 0; i < 4; i++) await t.settle();
    expect(t.lines()[3]).not.toBe(first);
    expect(bar().indexOf('█')).toBeGreaterThan(1);

    t.press('home');
    for (let i = 0; i < 4; i++) await t.settle();
    expect(t.lines()[3]).toBe(first);
    await t.unmount();
  });

  it('draws no scrollbar over a grid that fits', async () => {
    // A bar on a viewport with nothing to scroll is a lie about there being
    // more, which is worse than no bar - and it was drawn unconditionally.
    const t = await renderApp({
      width: 139,
      height: 60,
      onBoot: (app) => { registerShowcase(app, { wrap: 40, only: 'controls' }); },
    });
    for (let i = 0; i < 8; i++) await t.settle();

    expect(t.lines().map((line) => line.slice(-1)).join('')).not.toContain('█');
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
