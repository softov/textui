import { describe, expect, it } from 'vitest';
import { stringWidth } from '@textui/core';
import { Icon, ICON_WIDTH_SAFE, mono } from '../src/icons.js';

/**
 * A terminal is a grid.
 *
 * An icon that measures two cells pushes every row it appears in one column
 * out, and the row it breaks is usually not the row you were looking at. This
 * is the cheapest possible guard against that, and it runs over the whole set
 * rather than the one that was just added.
 */
describe('icons fit in one cell', () => {
  for (const name of ICON_WIDTH_SAFE) {
    it(`${name} is one cell wide`, () => {
      expect(stringWidth(Icon[name]), `${name} = "${Icon[name]}"`).toBe(1);
    });
  }

  it('asks for text presentation without changing what it measures', () => {
    // The selector is advisory - what matters is that adding it does not
    // widen the mark on a terminal that honours it.
    expect(stringWidth(mono('⚠'))).toBe(1);
  });

  it('has no two names sharing a glyph by accident', () => {
    // `▤` was Layout in one command and Toggle Sidebar in another. Deliberate
    // sharing is fine - save and the data kind are both a tray - so this only
    // reports, and the list is the record of what was meant.
    const byGlyph = new Map<string, string[]>();
    for (const [name, glyph] of Object.entries(Icon)) {
      byGlyph.set(glyph, [...(byGlyph.get(glyph) ?? []), name]);
    }
    const shared = [...byGlyph.entries()]
      .filter(([, names]) => names.length > 1)
      .map(([glyph, names]) => `${glyph}: ${names.join(', ')}`);
    expect(shared).toEqual([
      '⌸: data, save',
      '✎: edit, rename',
      '⌕: palette, search',
    ]);
  });
});
