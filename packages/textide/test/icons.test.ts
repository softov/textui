import { describe, expect, it } from 'vitest';
import { stringWidth } from '@textui/core';
import type { UnicodeLevel } from '@textui/core';
import {
  ASCII_ICONS, BMP_ICONS, FULL_ICONS, ICON_SETS, ICON_WIDTH_SAFE, Icon, iconsFor, mono,
} from '../src/icons.js';

/**
 * A terminal is a grid.
 *
 * An icon that measures two cells pushes every row it appears in one column
 * out, and the row it breaks is usually not the row you were looking at. This
 * is the cheapest possible guard against that, and it runs over the whole set
 * rather than the one that was just added - every tier, because the fallback
 * nobody looks at is exactly the one that will be wrong.
 */
describe('icons fit in one cell', () => {
  for (const [level, set] of Object.entries(ICON_SETS)) {
    for (const name of ICON_WIDTH_SAFE) {
      it(`${level}: ${name} is one cell wide`, () => {
        expect(stringWidth(set[name]), `${name} = "${set[name]}"`).toBe(1);
      });
    }
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

describe('the icon set for a terminal', () => {
  it('answers with the tier that terminal can draw', () => {
    expect(iconsFor('full')).toBe(FULL_ICONS);
    expect(iconsFor('bmp')).toBe(BMP_ICONS);
    expect(iconsFor('ascii')).toBe(ASCII_ICONS);
  });

  it('names the same icons at every tier', () => {
    const names = Object.keys(FULL_ICONS).sort();
    expect(Object.keys(BMP_ICONS).sort()).toEqual(names);
    expect(Object.keys(ASCII_ICONS).sort()).toEqual(names);
  });

  it('is actually ASCII at the ASCII tier', () => {
    // The point of the tier. A "fallback" holding one stray `⌸` fails on
    // exactly the terminal it exists for, and nowhere else.
    for (const [name, glyph] of Object.entries(ASCII_ICONS)) {
      expect(glyph.codePointAt(0), `${name} = "${glyph}"`).toBeLessThan(0x80);
    }
  });

  it('is inside the BMP at the BMP tier, and out of the dingbats', () => {
    for (const [name, glyph] of Object.entries(BMP_ICONS)) {
      const code = glyph.codePointAt(0) as number;
      expect(code, `${name} = "${glyph}"`).toBeLessThan(0x10000);
      // Dingbats and emoji-adjacent symbols are what a console font lacks.
      expect(code >= 0x2700 && code <= 0x27bf, `${name} = "${glyph}" is a dingbat`).toBe(false);
    }
  });

  const levels: UnicodeLevel[] = ['ascii', 'bmp', 'full'];
  for (const level of levels) {
    it(`${level}: never draws a blank`, () => {
      for (const [name, glyph] of Object.entries(iconsFor(level))) {
        expect(glyph.trim(), name).not.toBe('');
      }
    });
  }
});
