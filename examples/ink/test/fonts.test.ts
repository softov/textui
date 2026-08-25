import { describe, expect, it } from 'vitest';
import { FONTS, banner, fontAt, heightOf, inkGlyphs } from '../src/fonts.js';

/**
 * The fonts, as data.
 *
 * One hand-drawn table and three transforms of it, so most of what could go
 * wrong is a transform that loses a row, a column or a case rather than a
 * letter drawn badly - and that is what these check. What a letter *looks*
 * like is a judgement no assertion makes; the smoke test renders them.
 */

const PEN = { fill: '#', shade: '.', top: '"', bottom: '_' };

const rows = (text: string, font = FONTS[0] as (typeof FONTS)[number]): string[] =>
  banner(text, font, PEN).split('\n');

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
  it('says which fonts have two cases, and is right about it', () => {
    for (const font of FONTS) {
      const same = banner('A', font, PEN) === banner('a', font, PEN);
      // A transform of the five-row table cannot lose a case, and `mini` never
      // had one. Nothing in between, which is what `cases` is claiming.
      expect(same, font.id).toBe(font.cases === 'folded');
    }
    expect(FONTS.filter((f) => f.cases === 'both').length).toBeGreaterThan(1);
  });

  it('halves the height, and only in half cells', () => {
    const half = fontAt('half');
    expect(heightOf(half)).toBe(Math.ceil(heightOf(fontAt('block')) / 2));
    // Four characters for four combinations of two source rows.
    const drawn = new Set(rows('ABCDEFG', half).join('').split(''));
    drawn.delete(' ');
    expect([...drawn].sort()).toEqual(['"', '#', '_']);
  });

  it('draws dots with a colon wherever the stroke runs down', () => {
    // `I` is a bar, a stem and a bar: the stem is the part with a lit
    // neighbour above and below, and it is the only part drawn in colons.
    const drawn = rows('I', fontAt('dots'));
    // The bar is dots, except where the stem meets it - that cell has a lit
    // neighbour below, so it joins the stroke running down rather than the one
    // running across, which is the whole rule.
    expect(drawn[0]).toBe('..:..');
    expect(drawn[2]).toBe('  :');
    expect(drawn[4]).toBe('..:..');
  });

  it('spaces stars out, and draws nothing else', () => {
    const drawn = rows('A', fontAt('stars')).join('');
    expect(drawn).toContain('* * *');
    expect(drawn.replace(/[* \n]/g, '')).toBe('');
  });

  it('draws mini in strokes rather than in cells, so three rows can hold an alphabet', () => {
    const mini = fontAt('mini');
    expect(heightOf(mini)).toBe(3);
    // The letters a solid three-by-three block could not tell apart.
    expect(banner('A', mini)).not.toBe(banner('M', mini));
    expect(banner('G', mini)).not.toBe(banner('O', mini));
    // And nothing in it is a placeholder: it is already what it looks like.
    expect(banner('ABCXYZ', mini)).not.toContain('#');
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

describe('a banner too wide for its panel', () => {
  const widest = (text: string, font: (typeof FONTS)[number], width: number): number =>
    banner(text, font, PEN, width).split('\n').reduce((w, line) => Math.max(w, line.length), 0);

  // Every font, because the wrap measures letters and every font measures
  // differently - `wide` and `stars` are twice the pitch of the rest, and
  // `mini` is a third of the height.
  for (const font of FONTS) {
    for (const width of [40, 24]) {
      it(`keeps ${font.id} inside ${width} columns`, () => {
        expect(widest('Deployment finished in four minutes', font, width))
          .toBeLessThanOrEqual(width);
      });
    }
  }

  it('breaks between the letters of a word that cannot fit on a line of its own', () => {
    // Not by dropping the rest of it, which is what truncating did: every
    // letter is still somewhere.
    const drawn = banner('Deployment', fontAt('block'), PEN, 20);
    expect(drawn.split('\n\n').length).toBeGreaterThan(1);
    expect(widest('Deployment', fontAt('block'), 20)).toBeLessThanOrEqual(20);
  });

  it('fills a line before it starts the next one', () => {
    // The tail of a broken word and the start of the next word share a line -
    // a line holding three letters and a lot of air is not an improvement.
    const lines = banner('Deployment ok', fontAt('block'), PEN, 40).split('\n\n');
    expect(lines[lines.length - 1]).toContain('#');
    expect(lines.length).toBeLessThanOrEqual(3);
  });

  it('breaks nothing at all when it is not given a width', () => {
    const one = banner('Deployment finished', fontAt('block'), PEN);
    expect(one.split('\n\n')).toHaveLength(1);
  });

  it('still gives each typed line its own block, wrapped or not', () => {
    const drawn = banner('one\ntwo', fontAt('block'), PEN, 80);
    expect(drawn.split('\n\n')).toHaveLength(2);
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
    expect(inkGlyphs({ progressFull: '█', progressEmpty: '░' }))
      .toEqual({ fill: '█', shade: '░', top: '▀', bottom: '▄' });
    // The halves are not theme glyphs - the theme has no name for half a cell -
    // so the downgrade is stated here and nowhere else.
    expect(inkGlyphs({ progressFull: '#', progressEmpty: '-' }, false))
      .toEqual({ fill: '#', shade: '-', top: '"', bottom: '_' });
    expect(rows('A', fontAt('shadow')).join('')).not.toContain('█');
  });
});
