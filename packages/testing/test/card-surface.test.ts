import { describe, expect, it } from 'vitest';
import { h } from '@textui/core';
import { Card, Pattern } from '@textui/widgets';
import { renderApp } from '../src/index.js';
import type { Harness } from '../src/index.js';

/**
 * A card is a surface, so it clears what is behind it.
 *
 * A bordered box that states no background is a frame around whatever is
 * already there - and a pattern is exactly that, so a card dropped on one used
 * to show the tile through its own interior and read as a hole rather than as
 * something laid on top. `Dialog` and `CommandPalette` have always stated a
 * background for the same reason.
 */

const TILE = '########';
const CARD = { width: 12, height: 5 };

const open = async (card: Record<string, unknown> = {}): Promise<Harness> => {
  const t = await renderApp({
    width: 24,
    height: 8,
    theme: 'dark',
    root: h(Pattern, { tile: TILE, x: -1, y: -1, height: 8 },
      h(Card, { title: 'C', ...CARD, ...card }, h('text', { content: 'in' }))),
  });
  await t.settle();
  await t.settle();
  return t;
};

/** The card's own rect, as rows of the frame it should have cleared. */
const inside = (t: Harness): string[] =>
  Array.from({ length: CARD.height }, (_, y) => t.line(y).slice(0, CARD.width));

/**
 * Either shape a colour arrives in, as one comparable hex string: the theme
 * holds `'#161b22'` and a painted cell holds the rgb triple it unpacked to.
 */
const hex = (c: unknown): string => {
  if (typeof c === 'string') return c;
  if (c && typeof c === 'object' && 'rgb' in c) {
    const parts = (c as { rgb: number[] }).rgb;
    return `#${parts.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  }
  return String(c);
};

describe('a card over a pattern', () => {
  it('clears the tile inside its own box', async () => {
    const t = await open();
    for (const row of inside(t)) expect(row).not.toContain('#');
    await t.unmount();
  });

  it('leaves the tile outside its box', async () => {
    const t = await open();
    expect(t.line(CARD.height + 1)).toContain('#');
    await t.unmount();
  });

  it('fills with the surface token', async () => {
    const t = await open();
    expect(hex(t.app.buffer().get(6, 2)?.bg)).toBe(hex(t.app.theme.colors.surface));
    await t.unmount();
  });

  it('fills with the colour the caller names instead', async () => {
    const t = await open({ bg: 'canvas' });
    expect(hex(t.app.buffer().get(6, 2)?.bg)).toBe(hex(t.app.theme.colors.canvas));
    await t.unmount();
  });
});
