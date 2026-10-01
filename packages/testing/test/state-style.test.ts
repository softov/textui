import { describe, expect, it } from 'vitest';
import type { Color, ThemeDefinition } from '@textui/core';
import { BUILTIN_THEMES, h } from '@textui/core';
import { renderApp } from '../src/index.js';
import type { Harness } from '../src/index.js';

/**
 * A component's states reach the theme.
 *
 * Before this a theme could style `components.List.warning` but had no way to
 * say what a *selected row* looks like - there was no name for the state at
 * all, so the only place the colour could live was the node, where a theme
 * could not reach it. Now the states are named, the node says which ones it is
 * in, and the theme answers.
 *
 * These are plain boxes on purpose. Nothing here should know about lists.
 */

const STATE_THEME: ThemeDefinition = {
  id: 'state-probe',
  name: 'State probe',
  appearance: 'dark',
  extends: 'dark',
  colors: {},
  components: {
    Box: {
      selected: { bg: '#123456' },
      hover: { bg: '#111111' },
      active: { bg: '#222222' },
      focus: { bg: '#654321' },
      disabled: { bg: '#999999' },
      'solid.selected': { bg: '#abcdef' },
    },
  },
};

const under = (t: Harness, text: string): Color | undefined => {
  const lines = t.lines();
  for (let y = 0; y < lines.length; y++) {
    const x = (lines[y] as string).indexOf(text);
    if (x >= 0) return t.app.buffer().get(x, y)?.bg;
  }
  throw new Error(`no text "${text}" on screen`);
};

const hex = (color: Color | undefined): string | undefined => {
  if (!color || typeof color !== 'object' || !('rgb' in color)) return undefined;
  return `#${color.rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};

/**
 * The screen behind everything: a corner no component reaches.
 *
 * "Unpainted" is not the same as "no background" - the root box is filled with
 * the theme's canvas, so a state that states nothing lands on the canvas, and
 * that is the whole of what it should do.
 */
const backdrop = (t: Harness): string | undefined =>
  hex(t.app.buffer().get(t.app.size.width - 1, t.app.size.height - 1)?.bg);

/** Mount a box under the probe theme. */
const box = async (props: Record<string, unknown>, text = 'probe'): Promise<Harness> => {
  const t = await renderApp({
    width: 30,
    height: 5,
    root: h('box', { styleAs: 'Box', width: 12, ...props }, h('text', { content: text })),
    themes: [...BUILTIN_THEMES, STATE_THEME],
    theme: 'state-probe',
  });
  await t.settle();
  return t;
};

describe("a component's state reaches the theme", () => {
  it('is drawn with what the theme states for that state', async () => {
    const t = await box({ selected: true });
    expect(hex(under(t, 'probe'))).toBe('#123456');
    await t.unmount();
  });

  it('is left alone by a theme that states nothing for it', async () => {
    // The same node, under a theme with no `components` at all. The whole
    // point of the change is that a state nothing states is not painted, so
    // the row lands on the canvas like anything else.
    const t = await renderApp({
      width: 30,
      height: 5,
      root: h('box', { styleAs: 'Box', selected: true, width: 12 },
        h('text', { content: 'probe' })),
      theme: 'dark',
    });
    await t.settle();

    expect(hex(under(t, 'probe'))).toBe(backdrop(t));
    await t.unmount();
  });

  it('loses to a colour stated on the node itself', async () => {
    // The prop is closer to the cell than the theme is, and a caller who
    // needs one row in one state coloured differently should not have to
    // register a theme to get it.
    const t = await box({ selected: true, bg: 'danger' });
    expect(hex(under(t, 'probe'))).toBe('#f85149');
    await t.unmount();
  });

  it('is offered under the state names, most specific last', async () => {
    // `focus` over `selected`: the row under the cursor in a list that has the
    // keyboard is both, and the brighter of the two is what it should wear.
    const t = await box({ selected: true, focused: true });
    expect(hex(under(t, 'probe'))).toBe('#654321');
    await t.unmount();
  });

  it('lets `disabled` beat every other state, because it is the one that stops it', async () => {
    const t = await box({ selected: true, focused: true, hovered: true, disabled: true });
    expect(hex(under(t, 'probe'))).toBe('#999999');
    await t.unmount();
  });

  it('is also offered qualified by a variant, when the variant is what decides', async () => {
    // `Tabs.solid.selected` against a flat `Tabs.selected`: the state is the
    // same either way, and what differs is whether it paints at all.
    const t = await renderApp({
      width: 30,
      height: 5,
      root: h('box', { styleAs: 'Box', variant: 'solid', selected: true, width: 12 },
        h('text', { content: 'probe' })),
      themes: [...BUILTIN_THEMES, STATE_THEME],
      theme: 'state-probe',
    });
    await t.settle();

    expect(hex(under(t, 'probe'))).toBe('#abcdef');
    await t.unmount();
  });

  it('reaches only the component that names it', async () => {
    // Two boxes holding the same state, only one of them the owner. A theme
    // that restyles a list has to leave every other box on the screen exactly
    // as it was, and the second box here is selected too.
    const t = await renderApp({
      width: 30,
      height: 5,
      root: h('box', { direction: 'column', width: 30 },
        h('box', { styleAs: 'Box', selected: true, width: 12 },
          h('text', { content: 'probe' })),
        h('box', { selected: true, width: 12 },
          h('text', { content: 'other' }))),
      themes: [...BUILTIN_THEMES, STATE_THEME],
      theme: 'state-probe',
    });
    await t.settle();

    expect(hex(under(t, 'probe'))).toBe('#123456');
    expect(hex(under(t, 'other'))).toBe(backdrop(t));
    await t.unmount();
  });
});