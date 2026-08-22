import { describe, expect, it } from 'vitest';
import { asciiFallback, isAscii, parseTile, tileFrom } from '../src/tile.js';

/**
 * Reading a tile out of a text file.
 *
 * All of it is about what a text editor adds that nobody drew: a line ending
 * from another platform, the newline at the end of the file, a blank line left
 * above or below. None of those are cells, and every one of them would tile.
 */
describe('parseTile', () => {
  it('splits on newlines', () => {
    expect(parseTile('ab\ncd')).toEqual(['ab', 'cd']);
  });

  it('drops a carriage return from the end of every row', () => {
    // Left in, it is an invisible cell on the end of each row, and the tile
    // grows a column that is never drawn.
    expect(parseTile('ab\r\ncd\r\n')).toEqual(['ab', 'cd']);
  });

  it('drops the blank line a trailing newline leaves behind', () => {
    expect(parseTile('ab\ncd\n')).toEqual(['ab', 'cd']);
  });

  it('drops blank lines above and below', () => {
    expect(parseTile('\n\nab\ncd\n\n\n')).toEqual(['ab', 'cd']);
  });

  it('keeps a blank line inside the tile', () => {
    // A row of nothing between two rows of something is a row somebody meant.
    expect(parseTile('ab\n\ncd')).toEqual(['ab', '', 'cd']);
  });

  it('keeps a row of spaces as it was written', () => {
    expect(parseTile('ab\n  \ncd')).toEqual(['ab', '  ', 'cd']);
  });
});

describe('the ascii fallback', () => {
  it('leaves a tile that is already ascii alone', () => {
    expect(isAscii(['#.', '.#'])).toBe(true);
    expect(asciiFallback(['#.', '.#'])).toEqual(['#.', '.#']);
  });

  it('keeps the holes where the holes were', () => {
    // Shape before glyph: a pattern is which cells are inked, and that is what
    // has to survive a terminal that cannot draw the ink.
    expect(isAscii(['▘▗', '▝ '])).toBe(false);
    expect(asciiFallback(['▘▗', '▝ '])).toEqual(['##', '# ']);
  });
});

describe('tileFrom', () => {
  it('carries the tile, its fallback and where it came from', () => {
    expect(tileFrom('╱ \n ╱\n', 'hatch.txt')).toEqual({
      rows: ['╱ ', ' ╱'],
      ascii: ['# ', ' #'],
      source: 'hatch.txt',
    });
  });

  it('refuses a file with nothing in it', () => {
    // Not an error: the runner says so and carries on with the built-in tile.
    expect(tileFrom('', 'empty.txt')).toBeNull();
    expect(tileFrom('\n\n\n', 'blank.txt')).toBeNull();
  });
});
