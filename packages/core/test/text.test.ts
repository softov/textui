import { describe, expect, it } from 'vitest';
import {
  expandTabs, fitTo, graphemeWidth, padTo, repeatToWidth, sanitize,
  sliceByWidth, sliceColumns, stringWidth, truncate, wrapText,
} from '../src/util/text.js';

const ESC = String.fromCharCode(27);
const BEL = String.fromCharCode(7);

describe('stringWidth', () => {
  it('counts ascii by length', () => {
    expect(stringWidth('hello')).toBe(5);
    expect(stringWidth('')).toBe(0);
  });

  it('counts CJK as two cells', () => {
    expect(stringWidth('日本語')).toBe(6);
    expect(stringWidth('a日b')).toBe(4);
  });

  it('counts emoji as two cells, including ZWJ sequences', () => {
    expect(stringWidth('🌍')).toBe(2);
    expect(graphemeWidth('👩‍💻')).toBe(2);
  });

  it('ignores combining marks', () => {
    expect(stringWidth('é')).toBe(1);
  });

  it('measures box drawing and block glyphs as one cell', () => {
    expect(stringWidth('┌─┐│└┘')).toBe(6);
    expect(stringWidth('▁▂▄▇█')).toBe(5);
    expect(stringWidth('●◐○')).toBe(3);
  });
});

describe('sliceByWidth', () => {
  it('never splits a wide grapheme', () => {
    expect(sliceByWidth('日本語', 3)).toBe('日');
    expect(sliceByWidth('日本語', 4)).toBe('日本');
  });
});

describe('truncate', () => {
  it('truncates at the end by default', () => {
    expect(truncate('abcdefgh', 5)).toBe('abcd…');
  });
  it('truncates at the start', () => {
    expect(truncate('abcdefgh', 5, '…', 'start')).toBe('…efgh');
  });
  it('truncates in the middle', () => {
    expect(stringWidth(truncate('abcdefghij', 7, '…', 'middle'))).toBe(7);
  });
  it('leaves short strings alone', () => {
    expect(truncate('abc', 10)).toBe('abc');
  });
});

describe('padTo / fitTo', () => {
  it('pads to an exact cell width', () => {
    expect(padTo('ab', 5)).toBe('ab   ');
    expect(padTo('ab', 5, 'right')).toBe('   ab');
    expect(padTo('ab', 5, 'center')).toBe(' ab  ');
  });
  it('fits wide text to an exact width', () => {
    expect(stringWidth(fitTo('日本語です', 6))).toBe(6);
    expect(stringWidth(fitTo('ab', 6))).toBe(6);
  });
});

describe('wrapText', () => {
  it('wraps on words', () => {
    expect(wrapText('the quick brown fox', 10)).toEqual(['the quick', 'brown fox']);
  });
  it('breaks a word longer than the line', () => {
    expect(wrapText('supercalifragilistic', 8)).toEqual(['supercal', 'ifragili', 'stic']);
  });
  it('keeps explicit newlines', () => {
    expect(wrapText('a\nb', 10)).toEqual(['a', 'b']);
  });
  it('never exceeds the width', () => {
    for (const line of wrapText('one two three four five six seven', 9)) {
      expect(stringWidth(line)).toBeLessThanOrEqual(9);
    }
  });
});

describe('sanitize', () => {
  it('strips ansi and control characters', () => {
    expect(sanitize(ESC + '[31mred' + ESC + '[0m')).toBe('red');
    expect(sanitize('a' + BEL + 'b')).toBe('ab');
  });
  it('keeps newlines', () => {
    expect(sanitize('a\nb')).toBe('a\nb');
  });
});

describe('repeatToWidth', () => {
  it('fills exactly with single-width glyphs', () => {
    expect(repeatToWidth('─', 5)).toBe('─────');
    expect(stringWidth(repeatToWidth('─', 5))).toBe(5);
  });
});

describe('sliceColumns', () => {
  it('takes a window measured in cells', () => {
    expect(sliceColumns('abcdef', 2, 3)).toBe('cde');
    expect(sliceColumns('abcdef', 0, 100)).toBe('abcdef');
    expect(sliceColumns('abcdef', 10, 3)).toBe('');
    expect(sliceColumns('abcdef', 2, 0)).toBe('');
  });

  it('blanks the visible half of a wide grapheme rather than splitting it', () => {
    // 漢 is two cells wide. A window that contains only one of them cannot
    // show half a glyph, but it must still account for the cell, or the rest
    // of the line slides sideways against the gutter.
    expect(sliceColumns('漢字', 0, 2)).toBe('漢');
    expect(sliceColumns('漢字', 0, 3)).toBe('漢 ');
    expect(sliceColumns('漢字', 1, 2)).toBe('  ');
    expect(sliceColumns('漢字', 2, 2)).toBe('字');
  });

  it('keeps a combining mark with the grapheme it belongs to', () => {
    expect(sliceColumns('éx', 0, 1)).toBe('é');
  });
});

describe('expandTabs', () => {
  it('advances to the next tab stop, not by a fixed count', () => {
    expect(expandTabs('a\tb', 4)).toBe('a   b');
    expect(expandTabs('abc\td', 4)).toBe('abc d');
    expect(expandTabs('abcd\te', 4)).toBe('abcd    e');
  });

  it('restarts the count on every line', () => {
    expect(expandTabs('ab\tc\n\td', 4)).toBe('ab  c\n    d');
  });

  it('leaves text without tabs untouched', () => {
    const text = 'nothing to do here';
    expect(expandTabs(text)).toBe(text);
  });

  it('counts a wide character as two columns', () => {
    expect(expandTabs('漢\tx', 4)).toBe('漢  x');
  });
});
