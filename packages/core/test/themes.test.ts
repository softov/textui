import { describe, expect, it } from 'vitest';
import { createThemes } from '../src/themes/registry.js';
import type { TerminalCapabilities } from '../src/types/capabilities.js';

/**
 * What is written on a filled row.
 *
 * `selected` and `active` are backgrounds, and a background on its own says
 * nothing about the text over it. The on-tokens are derived from the theme's
 * own `inverted` and `text`, so a theme that restates either half keeps the
 * pair together - and a theme whose `text` is the terminal's has to state a
 * colour of its own, because the terminal's foreground is exactly what a
 * person may have set to the fill's colour.
 */

const CAPS = { colorDepth: 24, unicode: 'full' } as TerminalCapabilities;

describe('the colour written on a filled row', () => {
  it('is derived from the theme when the theme does not state it', () => {
    // `mono` states neither, so both fall back to its own pair.
    const mono = createThemes().resolve('mono', CAPS);
    expect(mono.colors.onSelected).toBe(mono.colors.inverted);
    expect(mono.colors.onActive).toBe(mono.colors.text);
  });

  it('is the theme\'s own where the theme states it', () => {
    // `dark` draws a selection with no fill, so the colour is the whole of
    // it: an accent rather than the text it would be written on.
    const dark = createThemes().resolve('dark', CAPS);
    expect(dark.colors.selected).toBe('default');
    expect(dark.colors.onSelected).not.toBe(dark.colors.inverted);
    expect(dark.colors.onActive).not.toBe(dark.colors.text);
  });

  it('is restated by a theme that brings back a fill', () => {
    // `console` extends `dark` but fills its selection, so it states the
    // colours that read on the fill rather than inheriting `dark`'s.
    const dark = createThemes().resolve('dark', CAPS);
    const console_ = createThemes().resolve('console', CAPS);
    expect(console_.colors.selected).not.toBe('default');
    expect(console_.colors.onSelected).not.toBe(dark.colors.onSelected);
    expect(console_.colors.onActive).toBe(console_.colors.text);
  });

  it('leaves `paper` a colour of its own for the fill', () => {
    const paper = createThemes().resolve('paper', CAPS);
    // The theme draws in the terminal's own foreground, which cannot be
    // guaranteed to read on a fill - so the fill states its own colour.
    expect(paper.colors.text).toBe('default');
    expect(paper.colors.onActive).not.toBe('default');
  });

  it('is nothing at all on a terminal with no colour', () => {
    const dark = createThemes().resolve('dark', { ...CAPS, colorDepth: 0 } as TerminalCapabilities);
    expect(dark.colors.onSelected).toBe('default');
    expect(dark.colors.onActive).toBe('default');
  });
});

describe('a theme with no colour', () => {
  it('gives back the terminal\'s own for a literal as well as a token', () => {
    const mono = createThemes().resolve('mono', CAPS);
    expect(mono.monochrome).toBe(true);
    expect(mono.color('accent')).toBe('default');
    // The one that used to get through: a component stating a hex of its own.
    expect(mono.color('#ff004d')).toBe('default');
  });

  it('leaves a theme with colour alone', () => {
    const dark = createThemes().resolve('dark', CAPS);
    expect(dark.monochrome).toBe(false);
    expect(dark.color('#ff004d')).toBe('#ff004d');
    expect(dark.color('accent')).toBe(dark.colors.accent);
  });
});
