import { describe, expect, it } from 'vitest';
import { h, notify } from '@textui/core';
import type { Color } from '@textui/core';
import { render, renderApp } from '../src/index.js';
import type { Harness } from '../src/index.js';

/**
 * Colour, where it is easy to get silently wrong.
 *
 * A terminal cell holds one foreground and one background. Two things follow,
 * and both were bugs: a `text` inside a coloured box has to inherit that
 * colour or it is drawn in the terminal's default one, and it has to inherit
 * the background or its glyphs punch a hole through the box behind them.
 */

function cellUnder(t: Harness, text: string) {
  const lines = t.lines();
  for (let y = 0; y < lines.length; y++) {
    const x = (lines[y] as string).indexOf(text);
    if (x >= 0) return t.app.buffer().get(x, y);
  }
  throw new Error(`no text "${text}" on screen`);
}

/** The screen behind everything: a corner no component reaches. */
function backdrop(t: Harness) {
  return t.app.buffer().get(t.app.size.width - 1, t.app.size.height - 1)?.bg;
}

function isDefault(color: Color | undefined): boolean {
  return color === undefined || color === 'default';
}

/** A painted colour, back in the form the theme states it. */
function hex(color: Color | undefined): string | undefined {
  if (!color || typeof color !== 'object' || !('rgb' in color)) return undefined;
  const [r, g, b] = color.rgb;
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

describe('colour inheritance', () => {
  it('gives a text node the colour of the box it is in', async () => {
    const t = await render(
      h('box', { fg: 'danger', bg: 'success', padding: [0, 1] }, h('text', { content: 'inside' })),
      { width: 20, height: 3 },
    );
    await t.settle();

    const cell = cellUnder(t, 'inside');
    // The same colours the padding around it got.
    expect(cell?.fg).toEqual(t.app.buffer().get(0, 0)?.fg);
    expect(cell?.bg).toEqual(t.app.buffer().get(0, 0)?.bg);
    await t.unmount();
  });

  it('lets a child state its own and keep the background', async () => {
    const t = await render(
      h('box', { fg: 'danger', bg: 'success', padding: [0, 1] },
        h('text', { content: 'inside', fg: 'warning' })),
      { width: 20, height: 3 },
    );
    await t.settle();

    const cell = cellUnder(t, 'inside');
    expect(cell?.fg).not.toEqual(t.app.buffer().get(0, 0)?.fg);
    expect(cell?.bg).toEqual(t.app.buffer().get(0, 0)?.bg);
    await t.unmount();
  });

  it('accumulates attributes down the tree', async () => {
    const t = await render(
      h('box', { bold: true }, h('text', { content: 'strong' })),
      { width: 20, height: 3 },
    );
    await t.settle();
    expect(cellUnder(t, 'strong')?.attrs).not.toBe(0);
    await t.unmount();
  });
});

describe('a selected thing is legible', () => {
  /** Every label a reader has to be able to read while it is selected. */
  const cases: { name: string; text: string; node: () => unknown }[] = [
    {
      name: 'a focused button',
      text: 'Press me',
      node: () => h('Button', { label: 'Press me', tone: 'danger', autoFocus: true }),
    },
    {
      name: 'a focused primary button',
      text: 'Confirm',
      node: () => h('Button', { label: 'Confirm', tone: 'primary', autoFocus: true }),
    },
    {
      name: 'a solid button at rest',
      text: 'Create',
      node: () => h('Button', { label: 'Create', tone: 'success', variant: 'solid' }),
    },
    {
      name: 'the highlighted menu row',
      text: 'chosen',
      node: () => h('Menu', {
        items: [{ id: 'a', label: 'chosen', description: 'with a description', shortcut: 'ctrl+a' }],
        autoFocus: true,
      }),
    },
    {
      name: 'the selected list row',
      text: 'selected-row',
      node: () => h('List', {
        items: [{ id: 'a', label: 'selected-row', meta: '3 items' }],
        autoFocus: true,
      }),
    },
    {
      name: 'the selected tree row',
      text: 'branch',
      node: () => h('Tree', { nodes: [{ id: 'a', label: 'branch', meta: '2 KB' }] }),
    },
    {
      name: 'the active solid tab',
      text: 'active-tab',
      node: () => h('Tabs', {
        items: [{ id: 'a', label: 'active-tab', badge: 4 }],
        variant: 'solid',
      }),
    },
  ];

  for (const testCase of cases) {
    it(`${testCase.name} is not drawn in the default colour on its own fill`, async () => {
      const t = await render(
        h('box', { direction: 'column' }, testCase.node()),
        { width: 44, height: 6 },
      );
      await t.settle();

      const cell = cellUnder(t, testCase.text);
      // Something decided this cell's colours: a label left at the terminal
      // default on a coloured fill is the bug this whole file is about.
      expect(isDefault(cell?.fg) && isDefault(cell?.bg)).toBe(false);
      // And whatever they are, they are not the same colour twice.
      expect(cell?.fg).not.toEqual(cell?.bg);
      await t.unmount();
    });
  }

  it('keeps a secondary column readable on the selected row', async () => {
    const t = await render(
      h('Menu', {
        items: [{ id: 'a', label: 'chosen', description: 'the description' }],
        autoFocus: true,
      }),
      { width: 44, height: 4 },
    );
    await t.settle();

    const label = cellUnder(t, 'chosen');
    const description = cellUnder(t, 'the description');
    expect(description?.bg).toEqual(label?.bg);
    expect(description?.fg).not.toEqual(description?.bg);
    await t.unmount();
  });
});

describe('a button says what it is by inverting', () => {
  it('draws a line at rest and fills when focused', async () => {
    const t = await render(
      h('box', { direction: 'row', gap: 1 },
        h('Button', { label: 'first', tone: 'success', autoFocus: true }),
        h('Button', { label: 'second', tone: 'success' })),
      { width: 40, height: 3 },
    );
    await t.settle();

    const focused = cellUnder(t, 'first');
    const resting = cellUnder(t, 'second');
    const behind = backdrop(t);

    // The focused one is filled with its tone; the resting one is that tone
    // as text, on whatever the screen behind it is.
    expect(focused?.bg).toEqual(resting?.fg);
    expect(resting?.bg).toEqual(behind);
    expect(focused?.bg).not.toEqual(behind);
    expect(focused?.fg).not.toEqual(focused?.bg);
    await t.unmount();
  });

  it('moves the fill with the focus', async () => {
    const t = await render(
      h('box', { direction: 'row', gap: 1 },
        h('Button', { label: 'first', autoFocus: true }),
        h('Button', { label: 'second' })),
      { width: 40, height: 3 },
    );
    await t.settle();
    const behind = backdrop(t);
    expect(cellUnder(t, 'first')?.bg).not.toEqual(behind);

    t.tab();
    await t.settle();
    expect(cellUnder(t, 'first')?.bg).toEqual(behind);
    expect(cellUnder(t, 'second')?.bg).not.toEqual(behind);
    await t.unmount();
  });

  it('writes each tone in the colour the theme states for it', async () => {
    const t = await render(
      h('box', { direction: 'column' },
        h('Button', { label: 'danger-button', tone: 'danger', autoFocus: true })),
      { width: 40, height: 3 },
    );
    await t.settle();

    const cell = cellUnder(t, 'danger-button');
    // The theme states `danger` and what to write on it; the button uses both
    // rather than one "inverted" colour that fits some tones and not others.
    expect(hex(cell?.bg)).toBe(t.app.theme.colors.danger);
    expect(hex(cell?.fg)).toBe(t.app.theme.colors.onDanger);
    await t.unmount();
  });
});

describe('the shell owns the screen', () => {
  /** Exactly how a runner builds an app: a `root` node, not a surface mount. */
  function rootApp(theme?: string) {
    return renderApp({
      width: 40,
      height: 8,
      shell: 'plain',
      ...(theme ? { theme } : {}),
      root: h('box', { padding: 1 }, h('text', { content: 'content' })),
    });
  }

  it('paints the canvas behind an app built from a root node', async () => {
    const t = await rootApp();
    await t.settle();

    // `root` is a mount inside the shell, not a replacement for it - so the
    // theme's canvas covers the terminal rather than leaving its own
    // background showing through.
    expect(backdrop(t)).toEqual({ rgb: [13, 17, 23] });
    await t.unmount();
  });

  it('makes a light theme light everywhere, not only inside dialogs', async () => {
    const t = await rootApp('light');
    await t.settle();

    const canvas = backdrop(t);
    const label = cellUnder(t, 'content');
    expect(canvas).toEqual({ rgb: [255, 255, 255] });
    expect(label?.bg).toEqual(canvas);
    // Dark ink on a light page, rather than light-theme ink on whatever the
    // terminal happened to be.
    expect(label?.fg).toEqual({ rgb: [31, 35, 40] });
    await t.unmount();
  });

  it('still honours setShell on an app built that way', async () => {
    const t = await rootApp();
    await t.settle();
    expect(t.hasText('content')).toBe(true);

    t.setShell('workbench');
    await t.settle();

    expect(t.app.activeShell()).toBe('workbench');
    expect(t.hasText('content')).toBe(true);
    await t.unmount();
  });

  it('shows a toast, which lives in the shell', async () => {
    const t = await rootApp();
    await t.settle();

    notify(t.app, { message: 'it happened' });
    await t.settle();

    expect(t.hasText('it happened')).toBe(true);
    await t.unmount();
  });
});

describe('a modal scrim', () => {
  it('recedes what is behind it instead of covering it', async () => {
    const t = await renderApp({
      width: 44,
      height: 10,
      shell: 'plain',
      root: h('box', { padding: 1 }, h('text', { content: 'behind-the-dialog' })),
    });
    await t.settle();
    const before = cellUnder(t, 'behind-the-dialog');

    t.app.layers.open({
      id: 'd',
      layer: 'modal',
      scrim: true,
      trapFocus: true,
      node: { component: 'Dialog', title: 'On top', width: 20 },
    });
    await t.settle();

    // Still there, still legible, and no longer competing with the dialog.
    expect(t.hasText('behind-the-dialog')).toBe(true);
    const after = cellUnder(t, 'behind-the-dialog');
    expect(after?.fg).not.toEqual(before?.fg);
    expect(after?.bg).not.toEqual(before?.bg);
    await t.unmount();
  });

  it('leaves the dialog itself untouched', async () => {
    const t = await renderApp({
      width: 44,
      height: 10,
      shell: 'plain',
      root: h('text', { content: 'behind' }),
    });
    await t.settle();

    t.app.layers.open({
      id: 'd',
      layer: 'modal',
      scrim: true,
      trapFocus: true,
      node: {
        component: 'Dialog',
        title: 'On top',
        width: 24,
        children: { component: 'text', content: 'in-front' },
      },
    });
    await t.settle();

    const dialogText = cellUnder(t, 'in-front');
    expect(dialogText?.fg).toEqual(t.app.buffer().get(0, 0)?.fg === undefined ? dialogText?.fg : dialogText?.fg);
    // The scrim is painted before the dialog, so the dialog keeps the theme's
    // own colours rather than a washed version of them.
    expect(dialogText?.bg).toEqual({ rgb: [28, 33, 40] });
    await t.unmount();
  });
});

/**
 * A surface has to be opaque, including where the theme has no colours.
 *
 * `mono` states every token as `default` - the terminal's own - which is the
 * whole point of it. The painter used to decide opacity by asking whether a
 * box's background resolved to something other than the default, so under that
 * theme nothing filled: a palette opened over a document drew its border and
 * its rows and left the document showing through the gaps between them.
 *
 * Stating a background and stating none are different things, and this is the
 * theme where the difference is the only thing that matters.
 */
describe('an overlay covers what is behind it', () => {
  const behind = 'ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ';

  const layered = async (theme: string) => {
    const t = await renderApp({
      width: 34,
      height: 6,
      theme,
      shell: 'plain',
      root: h('box', { direction: 'column' },
        ...Array.from({ length: 6 }, (_, i) => h('text', { key: i, content: behind }))),
      onBoot: (app) => {
        app.layers.open({
          id: 'panel',
          layer: 'modal',
          node: { component: 'box', width: 20, height: 3, bg: 'overlay', children: [
            { component: 'text', content: 'PANEL' },
          ] },
        });
      },
    });
    for (let i = 0; i < 4; i++) await t.settle();
    return t;
  };

  it.each(['dark', 'mono'])('leaves nothing showing through (%s)', async (theme) => {
    const t = await layered(theme);

    expect(t.hasText('PANEL')).toBe(true);
    // Three rows twenty columns wide are covered, so sixty of the Zs behind
    // are gone. A transparent panel loses only the five under "PANEL".
    const zs = [...t.text()].filter((c) => c === 'Z').length;
    expect(zs).toBe(6 * 30 - 3 * 20);
    await t.unmount();
  });
});

/**
 * One theme, one accent.
 *
 * A theme's accent is its identity, and a handful of tokens are nothing but
 * that accent drawn somewhere: the focus ring, the caret. They are separate
 * tokens so a theme *can* part them, but nobody ever means to - and a plain
 * merge along `extends` parts them silently. `console` set a teal accent over
 * `dark` and kept dark's blue focus ring; `paper` went warm all over and kept
 * a blue caret. Green in one place and blue in another, in one theme.
 */
describe('the accent family', () => {
  /** Rough hue in degrees, or null for a grey. */
  function hue(color: string): number | null {
    const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
    if (!m) return null;
    const [r, g, b] = [1, 2, 3].map((i) => parseInt(m[i] as string, 16) / 255) as [number, number, number];
    const max = Math.max(r, g, b);
    const delta = max - Math.min(r, g, b);
    if (delta < 0.04) return null;
    const raw = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
    return (raw * 60 + 360) % 360;
  }

  /** Shortest way round the wheel, so 350 and 10 are twenty apart. */
  function apart(a: number, b: number): number {
    const d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
  }

  for (const theme of ['dark', 'light', 'console', 'paper', 'paper-dark', 'workbench']) {
    it(`draws ${theme}'s focus ring and caret in its own accent`, async () => {
      const t = await renderApp({ width: 20, height: 3, theme, onBoot: () => {} });
      const colors = t.app.theme.colors;
      const accent = hue(String(colors.accent));
      expect(accent, `${theme} has no accent hue to compare against`).not.toBeNull();

      for (const token of ['focus', 'cursor', 'primary', 'selected', 'active'] as const) {
        const found = hue(String(colors[token]));
        if (found === null) continue;
        expect(
          apart(accent as number, found),
          `${theme}: ${token} is ${String(colors[token])}, a different colour from accent ${String(colors.accent)}`,
        ).toBeLessThan(40);
      }
      await t.unmount();
    });
  }
});
