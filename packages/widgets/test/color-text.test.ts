import { describe, expect, it } from 'vitest';
import type { Buffer } from '@textui/core';
import { h, renderOnce, toHex } from '@textui/core';
import { ColorText, painterOf } from '../src/display/index.js';
import { CATALOG } from '../src/index.js';

/*
 * A gradient is decoration, so none of these assert that a particular hex is
 * pretty. What they assert is that the colour lands on the cell it was
 * computed for - the two ways of counting a string, columns and graphemes,
 * disagree the moment the text is not plain ascii, and a ramp that uses the
 * wrong one shears.
 */
function paint(props: Record<string, unknown>, width = 24): {
  rows: string[];
  fg: (x: number, y: number) => string;
} {
  const result = renderOnce(h(ColorText, props), { width, components: CATALOG });
  try {
    const buffer = result.buffer as Buffer;
    const rows = result.text.split('\n').map((line) => line.trimEnd());
    const at = (x: number, y: number): string => toHex(buffer.fg[y * buffer.width + x] as number);
    return { rows, fg: at };
  } finally {
    result.dispose();
  }
}

describe('a block of coloured text', () => {
  it('is text first: uncoloured, it renders what it was given', () => {
    const { rows } = paint({ content: 'one\ntwo' });
    expect(rows[0]).toBe('one');
    expect(rows[1]).toBe('two');
  });

  // Two widths, because the ramp is measured against the block and not the
  // terminal - a wider terminal must not stretch it.
  for (const width of [24, 60]) {
    it(`ramps from the first stop to the last across the block at ${width} columns`, () => {
      const { fg } = paint({ content: 'abcde', ink: { gradient: ['#ff0000', '#0000ff'] } }, width);
      expect(fg(0, 0)).toBe('#ff0000');
      expect(fg(4, 0)).toBe('#0000ff');
      // Halfway along five cells is the middle one, and halfway between the
      // stops is an even mix of them.
      expect(fg(2, 0)).toBe('#800080');
    });
  }

  it('measures a ramp in columns, so a wide character does not shear it', () => {
    // Four graphemes, six columns. The last one starts at column 4.
    const { fg } = paint({ content: 'a世界b', ink: { gradient: ['#000000', '#ffffff'] } });
    expect(fg(0, 0)).toBe('#000000');
    expect(fg(1, 0)).toBe('#333333');
    expect(fg(3, 0)).toBe('#999999');
    expect(fg(5, 0)).toBe('#ffffff');
  });

  it('runs the ramp down the block on the y axis', () => {
    const ink = { gradient: ['#ff0000', '#0000ff'], axis: 'y' as const };
    const { fg } = paint({ content: 'ab\ncd\nef', ink });
    expect(fg(0, 0)).toBe('#ff0000');
    expect(fg(1, 0)).toBe('#ff0000');
    expect(fg(0, 2)).toBe('#0000ff');
  });

  it('shares one ramp across lines of different lengths, unless told otherwise', () => {
    const stops = ['#000000', '#ffffff'];
    // The short line stops partway along the ramp under `block`...
    const block = paint({ content: 'aaaaa\naa', ink: { gradient: stops } });
    expect(block.fg(1, 1)).toBe(block.fg(1, 0));
    // ...and reaches the end of it under `line`.
    const line = paint({ content: 'aaaaa\naa', ink: { gradient: stops, per: 'line' as const } });
    expect(line.fg(1, 1)).toBe('#ffffff');
  });

  it('takes an array of colours as one colour per line', () => {
    const { fg } = paint({ content: 'aa\nbb\ncc\ndd', ink: ['#ff0000', '#00ff00'] });
    expect([fg(0, 0), fg(0, 1), fg(0, 2), fg(0, 3)])
      .toEqual(['#ff0000', '#00ff00', '#ff0000', '#00ff00']);
  });

  it('walks a palette in runs, and repeats the pattern of runs', () => {
    const ink = { cycle: ['#ff0000', '#00ff00', '#0000ff'], every: [4, 3] };
    const { fg } = paint({ content: 'aaaaaaaaaaaa', ink });
    // Four red, three green, four blue, and then round to red again.
    expect(fg(3, 0)).toBe('#ff0000');
    expect(fg(4, 0)).toBe('#00ff00');
    expect(fg(6, 0)).toBe('#00ff00');
    expect(fg(7, 0)).toBe('#0000ff');
    expect(fg(11, 0)).toBe('#ff0000');
  });

  it('restarts a run on each line, so the bands of a block stay vertical', () => {
    const ink = { cycle: ['#ff0000', '#00ff00'], every: 2 };
    const { fg } = paint({ content: 'aaa\naaa', ink });
    expect(fg(2, 1)).toBe(fg(2, 0));
    const carried = paint({ content: 'aaa\naaa', ink: { ...ink, continuous: true } });
    expect(carried.fg(2, 1)).not.toBe(carried.fg(2, 0));
  });

  it('counts letters rather than columns when asked, skipping the spaces', () => {
    const ink = { cycle: ['#ff0000', '#00ff00'], unit: 'letter' as const, every: 2 };
    const { fg } = paint({ content: 'ab  cd', ink });
    expect(fg(0, 0)).toBe('#ff0000');
    expect(fg(1, 0)).toBe('#ff0000');
    expect(fg(4, 0)).toBe('#00ff00');
    expect(fg(5, 0)).toBe('#00ff00');
  });

  it('leaves a cell its own colour where the ink declines it', () => {
    const ink = (cell: { index: number }): string | undefined =>
      (cell.index === 0 ? '#ff0000' : undefined);
    const { fg } = paint({ content: 'ab', ink, fg: '#00ff00' });
    expect(fg(0, 0)).toBe('#ff0000');
    expect(fg(1, 0)).toBe('#00ff00');
  });

  it('resolves a theme token like any other colour', () => {
    const named = paint({ content: 'ab', ink: ['accent'] });
    const literal = paint({ content: 'ab', ink: ['#ff0000'] });
    expect(named.fg(0, 0)).not.toBe('#000000');
    expect(named.fg(0, 0)).not.toBe(literal.fg(0, 0));
  });

  it('wraps and aligns the way a text does', () => {
    const { rows } = paint({ content: 'one two three four', wrap: 'word', textAlign: 'right' }, 10);
    expect(rows[0]).toBe('   one two');
    expect(rows[1]).toBe('three four');
  });

  it('centres each line on its own, the way a text does', () => {
    const { rows } = paint({ content: 'aaaa\naa', textAlign: 'center' }, 8);
    expect(rows[0]).toBe('  aaaa');
    expect(rows[1]).toBe('   aa');
  });

  it('places the whole block at once when asked, so a picture does not shear', () => {
    // The short line keeps its offset from the long one rather than finding
    // its own middle - which is the difference between five rows of block
    // letters standing up straight and leaning.
    const { rows } = paint({ content: 'aaaa\naa', textAlign: 'center', alignBlock: true }, 8);
    expect(rows[0]).toBe('  aaaa');
    expect(rows[1]).toBe('  aa');
  });

  it('is nothing at all when it has no content', () => {
    expect(paint({ content: '' }).rows.join('')).toBe('');
  });
});

describe('an ink on its own', () => {
  // `painterOf` is exported for the components that paint their own cells, so
  // it has to work without a ColorText around it.
  const ctx = {
    theme: { color: (t: string) => t, glyphs: { ellipsis: '…' } },
    focused: false, hovered: false, active: false, selected: false, disabled: false,
  } as never;

  it('is a flat colour when a ramp has one stop', () => {
    const paint = painterOf({ gradient: ['#ff0000'] }, ctx);
    const cell = { char: 'a', col: 0, line: 0, index: 0, offset: 0, width: 1, height: 1, blockWidth: 1 };
    expect(paint(cell)).toEqual({ fg: '#ff0000' });
    expect(paint({ ...cell, col: 9, blockWidth: 10 })).toEqual({ fg: '#ff0000' });
  });

  it('is nothing when there is no ink at all', () => {
    expect(painterOf(undefined, ctx)({
      char: 'a', col: 0, line: 0, index: 0, offset: 0, width: 1, height: 1, blockWidth: 1,
    })).toBeUndefined();
  });
});
