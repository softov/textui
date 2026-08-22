/**
 * A tile, read from a text file.
 *
 * Kept out of the component and out of the runner so both can use it and a
 * test can use it without either. Reading the file is the runner's job -
 * nothing under `src/components` may reach for `node:fs`, or the component
 * stops being liftable into the library.
 */

/** Where the runner leaves a tile it was given, for the playground to find. */
export const TILE_PATH = '$/demo/pattern/tile';

export interface TileSource {
  rows: string[];
  /** What to draw instead on a terminal that cannot manage `rows`. */
  ascii: string[];
  /** Where it came from. Shown on screen, so a wrong file is obvious. */
  source: string;
}

/**
 * The lines of a file, as tile rows.
 *
 * Split on `\n` and drop a trailing `\r`, so a file written on Windows tiles
 * the same as one written here rather than carrying an invisible cell at the
 * end of every row. Blank lines at the top and bottom go - they are how a text
 * editor ends a file, not something anybody drew - but a blank line *inside*
 * the tile stays, because a row of nothing is a row somebody meant.
 */
export function parseTile(text: string): string[] {
  const rows = text.split('\n').map((row) => row.replace(/\r$/, ''));
  while (rows.length > 0 && rows[0] === '') rows.shift();
  while (rows.length > 0 && rows[rows.length - 1] === '') rows.pop();
  return rows;
}

/** True when every cell is something an `unicode: 'ascii'` terminal can draw. */
export function isAscii(rows: string[]): boolean {
  return rows.every((row) => /^[ -~]*$/.test(row));
}

/**
 * The same tile with everything unprintable replaced.
 *
 * A pattern is shape before it is glyph, so a fallback that keeps the holes
 * where the holes were is worth more than one that keeps the characters. Ink
 * becomes `#` and a space stays a space, which tiles identically.
 */
export function asciiFallback(rows: string[]): string[] {
  if (isAscii(rows)) return rows;
  return rows.map((row) => [...row].map((cell) => (cell === ' ' ? ' ' : '#')).join(''));
}

/** A file's contents, as something the playground can render. */
export function tileFrom(text: string, source: string): TileSource | null {
  const rows = parseTile(text);
  if (rows.length === 0) return null;
  return { rows, ascii: asciiFallback(rows), source };
}
