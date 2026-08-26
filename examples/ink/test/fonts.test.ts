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

  // A `T` and an `I` are the same two strokes and they settle the junction
  // differently, which is the whole rule: a stem hanging below a bar does not
  // take a cell out of it, and a stem landing on one shows where it lands.
  it('leaves a bar whole where a stem only hangs below it', () => {
    const drawn = rows('T', fontAt('dots'));
    expect(drawn[0]).toBe('.....');
    expect(drawn.slice(1).every((line) => line.trim() === ':')).toBe(true);
  });

  it('marks a bar where a stem lands on it', () => {
    const drawn = rows('I', fontAt('dots'));
    expect(drawn[0]).toBe('.....');
    expect(drawn[2]).toBe('  :');
    expect(drawn[4]).toBe('..:..');
  });

  it('keeps a stem running through the end of a bar', () => {
    // `E` is one stem and three bars. Every bar starts on the stem, and the
    // stem is what those three cells belong to.
    const drawn = rows('E', fontAt('dots'));
    // The top bar has nothing above it anywhere, so it is a bar all the way
    // across - the stem has not started yet. The other two cross a stem that
    // is already running, and the cell it passes through stays the stem's.
    expect(drawn[0]).toBe('.....');
    expect(drawn[2]).toBe(':...');
    expect(drawn[4]).toBe(':....');
  });

  it('draws a stroke with nothing beside it as a dot', () => {
    // The last column of a row used to read its own end-of-string as a
    // neighbour, so a cell with nothing beside it looked joined. `X` is
    // nothing but diagonals: no cell has an orthogonal neighbour at all.
    expect(rows('X', fontAt('dots')).join('')).not.toContain(':');
  });

  it('spaces stars out, and draws nothing else', () => {
    const drawn = rows('A', fontAt('stars')).join('');
    expect(drawn).toContain('* * *');
    expect(drawn.replace(/[* \n]/g, '')).toBe('');
  });

  it('draws gard with two cases of its own, and a real descender', () => {
    const gard = fontAt('gard');
    expect(gard.cases).toBe('both');
    // Nine rows in the table so every glyph agrees where the baseline is, but
    // a line of capitals is five: `banner` trims the blank rows off a finished
    // line, and capitals do not use the two above or the two below.
    expect(heightOf(gard)).toBe(9);
    expect(rows('ABC', gard)).toHaveLength(5);
    // A descender is not a taller letter, it is a letter sitting lower - `g`
    // on its own is five rows like any other, and only shows what it does when
    // there is a capital beside it to be lower *than*.
    expect(rows('ggg', gard)).toHaveLength(5);
    expect(rows('Ag', gard)).toHaveLength(6);
    // And a digit is drawn from two rows higher, so it shows the same way at
    // the other end.
    expect(rows('A4', gard)).toHaveLength(7);
  });

  it('has every letter of both cases and every digit in gard', () => {
    const gard = fontAt('gard');
    const seen = new Map<string, string>();
    for (const char of 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') {
      const drawn = banner(char, gard);
      expect(drawn, char).not.toBe('');
      // Two glyphs collapsing into one is the mistake a transcription of
      // sixty-two makes, and nothing else here would notice.
      expect(seen.get(drawn), `${char} is the same as ${seen.get(drawn) ?? ''}`).toBeUndefined();
      seen.set(drawn, char);
    }
  });

  it('draws tmplt from the transcribed table, with every capital distinct', () => {
    const tmplt = fontAt('tmplt');
    expect(heightOf(tmplt)).toBe(3);
    const seen = new Map<string, string>();
    for (const cap of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
      const drawn = banner(cap, tmplt);
      expect(drawn, cap).not.toBe('');
      // A transcription is easy to fat-finger into two letters that are the
      // same glyph, and nothing else here would notice.
      expect(seen.get(drawn), `${cap} is the same as ${seen.get(drawn) ?? ''}`).toBeUndefined();
      seen.set(drawn, cap);
    }
    for (const digit of '0123456789') expect(banner(digit, tmplt), digit).not.toBe('');
  });

  it('gives tmplt a stand-in for the terminal that cannot draw it', () => {
    // Box-drawing has no `#` to degrade to, so this is the one font that names
    // another rather than a character.
    const tmplt = fontAt('tmplt');
    expect(tmplt.fallback).toBe('mini');
    expect(heightOf(fontAt(tmplt.fallback as string))).toBe(heightOf(tmplt));
    // And every other font stands on its own.
    expect(FONTS.filter((f) => f.fallback !== undefined).map((f) => f.id)).toEqual(['tmplt']);
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
