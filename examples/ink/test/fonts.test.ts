import { describe, expect, it } from 'vitest';
import { stringWidth } from '@textui/core';
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
    // Every glyph the same height, or they do not agree where the baseline is.
    const heights = [...new Set(Object.values(gard.glyphs).map((g) => g.length))];
    expect(heights, `gard glyph heights: ${heights.join(', ')}`).toEqual([9]);
    expect(rows('ABC', gard)).toHaveLength(5);
    // A descender is not a taller letter, it is a letter sitting lower - `g`
    // on its own is five rows like any other, and only shows what it does when
    // there is a capital beside it to be lower *than*.
    expect(rows('ggg', gard)).toHaveLength(5);
    expect(rows('Ag', gard)).toHaveLength(6);
    // A digit is cap-height here rather than taller, so `A4` is the five rows
    // a capital already was.
    expect(rows('A4', gard)).toHaveLength(5);
    // The two rows above the capitals are not spare, though - a bracket and a
    // dollar reach into them, which is what makes them worth keeping in the
    // table when a line of capitals never touches them.
    expect(rows('A$', gard)).toHaveLength(7);
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
    // Three rows of letter and a fourth the tails hang into, so a line of
    // capitals is three rows and one with a `g` in it is four.
    expect(heightOf(tmplt)).toBe(4);
    expect(banner('ABC', tmplt).split('\n')).toHaveLength(3);
    expect(banner('Ag', tmplt).split('\n')).toHaveLength(4);
    // An x-height letter starts a row below a capital and ends level with it.
    expect(banner('ao', tmplt).split('\n')).toHaveLength(2);
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
    // Near enough the same height to stand in for it - within the row `tmplt`
    // keeps for its descenders.
    expect(heightOf(fontAt(tmplt.fallback as string)))
      .toBeGreaterThanOrEqual(heightOf(tmplt) - 1);
    // And every other font stands on its own.
    expect(FONTS.filter((f) => f.fallback !== undefined).map((f) => f.id).sort())
      .toEqual(['pagga', 'tmplt']);
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

describe('every character, in every font', () => {
  const ALL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    + "!?.,:;-+=*/\\()'\"#@&<>_";

  for (const font of FONTS) {
    it(`draws something for all of them in ${font.id}`, () => {
      // Not "has a glyph for" - "draws something". A font that is missing a
      // glyph renders the character as itself, so nothing comes out as a gap:
      // a gap is indistinguishable from a space, and `hello, world!` in a font
      // with no punctuation looked like it had worked.
      const blank = [...ALL].filter((c) => banner(c, font, PEN).trim() === '');
      expect(blank, `${font.id} draws nothing for ${blank.join(' ')}`).toEqual([]);
    });
  }

  for (const font of FONTS) {
    it(`gives ${font.id} no two characters the same glyph`, () => {
      // The mistake that put the same zigzag on `(` and `<`, and the same
      // chevron on `{` and `<` after that. Two characters drawing the same
      // thing is always a bug and never a decision, so it is worth an
      // assertion rather than an eye.
      // The whole grid, not what one character renders to on its own: `-` and
      // `_` are the same bar and differ only in the row they sit on, and a
      // banner of one character trims the blank rows away and loses that.
      const seen = new Map<string, string>();
      const clashes: string[] = [];
      for (const char of Object.keys(font.glyphs)) {
        if (char === ' ') continue;
        const drawn = (font.glyphs[char] as string[]).join('\n').trimEnd();
        const already = seen.get(drawn);
        if (already !== undefined && already.toLowerCase() !== char.toLowerCase()) {
          clashes.push(`${already}=${char}`);
        }
        seen.set(drawn, char);
      }
      expect(clashes, `${font.id}: ${clashes.join(' ')}`).toEqual([]);
    });
  }

  it('draws a missing character as itself, on the line', () => {
    // `mini` has no `$`: at three rows there is no stroke that says dollar
    // rather than S-with-a-line, so it is left to the stand-in on purpose.
    const mini = fontAt('mini');
    expect(mini.glyphs['$']).toBeUndefined();
    const drawn = rows('A$', mini);
    expect(drawn.join('')).toContain('$');
    // On the baseline, so it sits on the line with the letter beside it.
    expect(drawn[drawn.length - 1]).toContain('$');
  });

  it('does not mistake a drawn character for a placeholder', () => {
    // `#` is what a block glyph is written in, and `mini` draws a literal one.
    // Running the substitution over a hand-drawn table turned it into a wall.
    const blocks = inkGlyphs({ progressFull: '█', progressEmpty: '░' });
    // The five-row table is written in `#`, so a `|` drawn there comes out in
    // whatever the theme fills with...
    expect(fontAt('block').placeholders).toBe(true);
    expect(banner('|', fontAt('block'), blocks)).toBe('█\n█\n█\n█\n█');
    // ...and a hand-drawn table comes out exactly as it was written, which is
    // what stops a literal `#` or `v` in one of them being swapped for a cell.
    expect(fontAt('mini').placeholders).toBeUndefined();
    expect(banner('|', fontAt('mini'), blocks)).toBe('|\n|\n|');
  });

  it('tells a bracket from an angle', () => {
    // Both were drawn as the same zigzag, so `(a)` and `<a>` were one string.
    expect(banner('(', fontAt('block'), PEN)).not.toBe(banner('<', fontAt('block'), PEN));
    expect(banner(')', fontAt('block'), PEN)).not.toBe(banner('>', fontAt('block'), PEN));
  });
});

describe('text that arrives by paste', () => {
  const block = fontAt('block');
  const at = (cp: number): string => String.fromCodePoint(cp);

  // Every one of these turns up in a copy-paste and none of them is visible in
  // the field it was pasted into.
  const NOTHING = [
    ['a zero-width space', 0x200b],
    ['a zero-width joiner', 0x200d],
    ['a byte-order mark', 0xfeff],
    ['a left-to-right mark', 0x200e],
    ['a soft hyphen', 0x00ad],
    ['a tab', 0x09],
    ['an escape', 0x1b],
    ['a combining accent', 0x0301],
  ] as const;

  for (const [name, cp] of NOTHING) {
    it(`draws ${name} as nothing, not as a word gap`, () => {
      // It used to get the treatment a character with no glyph gets, which is
      // a word gap - so `AB` pasted with one of these between the letters came
      // out as `A B`, with a word break the field never showed.
      expect(banner(`A${at(cp)}B`, block, PEN)).toBe(banner('AB', block, PEN));
    });
  }

  it('draws a non-breaking space as the space it is', () => {
    // The other half of the same mistake: this one *is* a space, and it was
    // rendering as one blank cell rather than as a gap between words.
    expect(banner(`A${at(0x00a0)}B`, block, PEN)).toBe(banner('A B', block, PEN));
  });

  it('measures a stand-in by the cells it takes, not by its length', () => {
    // A wide character is one string index and two columns. Measured by index
    // it was reckoned a column narrower than it drew, so everything after it
    // sat a column to the left of where the wrap thought it was.
    const drawn = banner(`A${at(0x4e16)}B`, block, PEN);
    const widest = Math.max(...drawn.split('\n').map((line) => stringWidth(line)));
    // The measuring and the drawing agree: it fits a panel of exactly its own
    // width, and not one column less.
    expect(banner(`A${at(0x4e16)}B`, block, PEN, widest)).toBe(drawn);
    expect(banner(`A${at(0x4e16)}B`, block, PEN, widest - 1)).not.toBe(drawn);
  });

  it('leaves the fonts themselves free of anything invisible', () => {
    // The tables are typed and pasted like anything else. A zero-width
    // character in one of them would shift a single row of a single glyph and
    // be very hard to find by eye.
    for (const font of FONTS) {
      for (const [key, rows] of Object.entries(font.glyphs)) {
        for (const row of rows) {
          expect(stringWidth(row), `${font.id} ${JSON.stringify(key)}: ${JSON.stringify(row)}`)
            .toBe(row.length);
        }
      }
    }
  });
});

describe('the pagga table', () => {
  const pagga = fontAt('pagga');

  it('is three rows on a ground, and folds its case', () => {
    expect(heightOf(pagga)).toBe(3);
    expect(pagga.cases).toBe('folded');
    expect(banner('A', pagga)).toBe(banner('a', pagga));
  });

  it('runs its ground through a word space', () => {
    // The space is a glyph rather than a gap. A gap would be a hole in it.
    const drawn = banner('a a', pagga).split('\n');
    expect(drawn.every((line) => !line.includes('  '))).toBe(true);
    expect(pagga.glyphs[' ']).toBeDefined();
  });

  it('has every letter and digit, each one distinct', () => {
    const seen = new Map<string, string>();
    for (const char of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') {
      const drawn = banner(char, pagga);
      expect(seen.get(drawn), `${char} is the same as ${seen.get(drawn) ?? ''}`).toBeUndefined();
      seen.set(drawn, char);
    }
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
