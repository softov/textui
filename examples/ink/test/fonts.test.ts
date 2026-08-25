import { describe, expect, it } from 'vitest';
import { FONTS, banner, fillGlyphs, fontAt, heightOf } from '../src/fonts.js';

/**
 * The fonts, as data.
 *
 * One hand-drawn table and three transforms of it, so most of what could go
 * wrong is a transform that loses a row, a column or a case rather than a
 * letter drawn badly - and that is what these check. What a letter *looks*
 * like is a judgement no assertion makes; the smoke test renders them.
 */

const rows = (text: string, font = FONTS[0] as (typeof FONTS)[number]): string[] =>
  banner(text, font, '#', '.').split('\n');

describe('the block table', () => {
  it('has a glyph for both cases of every letter, and they differ', () => {
    for (const upper of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
      const lower = upper.toLowerCase();
      expect(rows(upper).join('\n'), upper).not.toBe('');
      expect(rows(lower).join('\n'), lower).not.toBe('');
      expect(rows(upper).join('\n'), `${upper} vs ${lower}`).not.toBe(rows(lower).join('\n'));
    }
  });

  it('draws a capital taller than an x-height letter', () => {
    // The two cases share a baseline, and that is the whole reason for a
    // second set rather than folding the case away.
    expect(rows('A')).toHaveLength(5);
    expect(rows('a')).toHaveLength(4);
    expect(rows('b')).toHaveLength(5);
  });

  it('has a glyph for every digit', () => {
    for (const digit of '0123456789') expect(rows(digit).join(''), digit).toContain('#');
  });

  it('turns a character it has never seen into a space, not into nothing', () => {
    // A gap the reader can see beats a line that silently closes up.
    expect(rows('a€a')[0]).toMatch(/#\s{3,}#/);
  });
});

describe('the transforms', () => {
  it('keeps every font on the same table, so every font has both cases', () => {
    for (const font of FONTS) {
      expect(banner('A', font, '#'), font.id).not.toBe(banner('a', font, '#'));
    }
  });

  it('draws wide twice as broad and no taller', () => {
    const block = rows('A');
    const wide = rows('A', fontAt('wide'));
    expect(wide).toHaveLength(block.length);
    expect((wide[2] as string).length).toBe((block[2] as string).length * 2);
  });

  it('leans slant to the right, and only to the right', () => {
    // `H` because every one of its rows starts with a stroke, so the indent
    // is the shear and nothing else.
    const slanted = rows('H', fontAt('slant'));
    const indent = (line: string): number => line.length - line.trimStart().length;
    // Every row starts at or left of the one above it: a shear, not a wobble.
    for (let i = 1; i < slanted.length; i++) {
      expect(indent(slanted[i] as string)).toBeLessThanOrEqual(indent(slanted[i - 1] as string));
    }
    expect(indent(slanted[0] as string)).toBeGreaterThan(indent(slanted[slanted.length - 1] as string));
  });

  it('gives shadow a second glyph, a row of height, and no shadow inside a counter', () => {
    const shadowed = rows('A', fontAt('shadow'));
    expect(shadowed.join('')).toContain('.');
    expect(heightOf(fontAt('shadow'))).toBe(heightOf(fontAt('block')) + 1);
    // The triangle above the crossbar of an `A` is enclosed, so nothing falls
    // into it - the bug that turned a capital into a smudge.
    expect(shadowed[1]).toBe('#   #');
  });
});

describe('a banner of more than one word', () => {
  it('gives each line of the text its own block of rows', () => {
    const one = rows('AB');
    const two = rows('AB\nAB');
    // Two blocks and the blank row between them.
    expect(two).toHaveLength(one.length * 2 + 1);
    expect(two[one.length]).toBe('');
  });

  it('spaces words without letting them run together', () => {
    const line = rows('AA A')[0] as string;
    expect(line).toMatch(/#\s{3,}#/);
  });

  it('takes its characters from the theme, down to ascii', () => {
    expect(fillGlyphs({ progressFull: '█', progressEmpty: '░' })).toEqual({ fill: '█', shade: '░' });
    expect(fillGlyphs({ progressFull: '#', progressEmpty: '-' })).toEqual({ fill: '#', shade: '-' });
    expect(rows('A', fontAt('shadow')).join('')).not.toContain('█');
  });
});
