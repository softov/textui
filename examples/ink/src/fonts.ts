/**
 * Block fonts, so there is something worth colouring.
 *
 * They live in the example and not in the library on purpose. `ColorText`
 * colours whatever string it is handed and has no opinion about where the
 * string came from - the plain mode of this demo passes ordinary prose through
 * the identical component and the identical inks. A font is data an
 * application brings; a catalog that shipped one would be shipping a figlet
 * nobody asked it to keep up to date.
 *
 * There is one hand-drawn table and three transforms of it, which is the other
 * thing worth showing: a bitmap font is a grid of characters, and a grid of
 * characters can be sheared, doubled or duplicated by ten lines of code. Every
 * font below has both cases, because the table does.
 *
 * `#` is where the ink goes, `%` is a second glyph for the fonts that use one,
 * and a space is nothing. Blank columns at either edge are trimmed when a
 * glyph is used, so the letters are proportional rather than a fixed pitch.
 */

type Grid = string[];

/**
 * Capitals, five rows on a five-column body.
 *
 * Every stroke is one cell thick, which is what makes these legible at this
 * size and what makes the `shadow` transform read as a shadow rather than as
 * a thicker letter.
 */
const CAPS: Record<string, string> = {
  A: ' ### |#   #|#####|#   #|#   #',
  B: '#### |#   #|#### |#   #|#### ',
  C: ' ####|#    |#    |#    | ####',
  D: '#### |#   #|#   #|#   #|#### ',
  E: '#####|#    |#### |#    |#####',
  F: '#####|#    |#### |#    |#    ',
  G: ' ####|#    |#  ##|#   #| ####',
  H: '#   #|#   #|#####|#   #|#   #',
  I: '#####|  #  |  #  |  #  |#####',
  J: '#####|   # |   # |#  # | ##  ',
  K: '#   #|#  # |###  |#  # |#   #',
  L: '#    |#    |#    |#    |#####',
  M: '#   #|## ##|# # #|#   #|#   #',
  N: '#   #|##  #|# # #|#  ##|#   #',
  O: ' ### |#   #|#   #|#   #| ### ',
  P: '#### |#   #|#### |#    |#    ',
  Q: ' ### |#   #|#   #|#  # | ## #',
  R: '#### |#   #|#### |#  # |#   #',
  S: ' ####|#    | ### |    #|#### ',
  T: '#####|  #  |  #  |  #  |  #  ',
  U: '#   #|#   #|#   #|#   #| ### ',
  V: '#   #|#   #|#   #| # # |  #  ',
  W: '#   #|#   #|# # #|## ##|#   #',
  X: '#   #| # # |  #  | # # |#   #',
  Y: '#   #| # # |  #  |  #  |  #  ',
  Z: '#####|   # |  #  | #   |#####',
};

/**
 * Lowercase, on the same five rows.
 *
 * The body sits on rows two to five and the ascenders reach up into row one,
 * so the two cases share a baseline and a cap is visibly taller than an x -
 * which is the whole reason for having a second set rather than folding the
 * case away. Nothing descends below the baseline: five rows is not enough to
 * put a tail under a `g` and keep the line spacing honest, so the tails curl
 * sideways instead.
 */
const LOWER: Record<string, string> = {
  a: '    | ###|#  #|#  #| ###',
  b: '#   |#   |### |#  #|### ',
  c: '    | ###|#   |#   | ###',
  d: '   #|   #| ###|#  #| ###',
  e: '    | ## |#  #|####| ###',
  f: '  ##| #  |### | #  | #  ',
  g: '    | ###|#  #| ###|### ',
  h: '#   |#   |### |#  #|#  #',
  i: ' #  |    |##  | #  |### ',
  j: '  # |    | ## |  # |##  ',
  k: '#   |#  #|##  |# # |#  #',
  l: '##  | #  | #  | #  |### ',
  m: '     |     |#### |# # #|# # #',
  n: '    |    |### |#  #|#  #',
  o: '    |    | ## |#  #| ## ',
  p: '    |### |#  #|### |#   ',
  q: '    | ###|#  #| ###|   #',
  r: '    |    |# ##|##  |#   ',
  s: '    | ###| ## |   #|### ',
  t: ' #  |### | #  | #  |  ##',
  u: '    |    |#  #|#  #| ###',
  v: '    |    |#  #|#  #| ## ',
  w: '     |     |# # #|# # #| # # ',
  x: '    |    |#  #| ## |#  #',
  y: '    |#  #|#  #| ###|### ',
  z: '    |    |####| ## |####',
};

const REST: Record<string, string> = {
  0: ' ### |#  ##|# # #|##  #| ### ',
  1: '  #  | ##  |  #  |  #  |#####',
  2: ' ### |#   #|   # |  #  |#####',
  3: '#### |    #| ### |    #|#### ',
  4: '#  # |#  # |#####|   # |   # ',
  5: '#####|#    |#### |    #|#### ',
  6: ' ### |#    |#### |#   #| ### ',
  7: '#####|   # |  #  | #   | #   ',
  8: ' ### |#   #| ### |#   #| ### ',
  9: ' ### |#   #| ####|    #| ### ',
  '!': ' # | # | # |   | # ',
  '?': ' ### |#   #|   # |     |  #  ',
  '.': '   |   |   |   | # ',
  ',': '   |   |   | # |#  ',
  ':': '   | # |   | # |   ',
  ';': '   | # |   | # |#  ',
  '-': '    |    |####|    |    ',
  '+': '     |  #  | ### |  #  |     ',
  '=': '    |####|    |####|    ',
  '*': '     |# # | ### |# # |     ',
  '/': '    #|   # |  #  | #   |#    ',
  '\\': '#    | #   |  #  |   # |    #',
  '(': '  #| # |#  |# # | #',
  ')': '#  | # |  #| # |#  ',
  "'": ' # | # |   |   |   ',
  '"': '# #|# #|   |   |   ',
  '#': ' # # |#####| # # |#####| # # ',
  '@': ' ### |#   #|# ## |#    | ### ',
  '&': ' ##  |##   | ### |#  # | ## #',
  '<': '  #| # |#  | # |  #',
  '>': '#  | # |  #| # |#  ',
  _: '    |    |    |    |####',
};

/** The one hand-drawn table: every glyph, in both cases. */
const BLOCK: Record<string, Grid> = Object.fromEntries(
  Object.entries({ ...CAPS, ...LOWER, ...REST }).map(([key, spec]) => [key, pad(spec.split('|'))]),
);

// ------------------------------------------------------------- transforms

/** Every row the same length, so a transform can index a rectangle. */
function pad(rows: Grid): Grid {
  const width = rows.reduce((w, row) => Math.max(w, row.length), 0);
  return rows.map((row) => row.padEnd(width, ' '));
}

function mapGlyphs(font: Record<string, Grid>, fn: (rows: Grid) => Grid): Record<string, Grid> {
  return Object.fromEntries(Object.entries(font).map(([key, rows]) => [key, pad(fn(rows))]));
}

/** Every column twice. Twice the letter, the same shape. */
function wide(rows: Grid): Grid {
  return rows.map((row) => Array.from(row).map((c) => c + c).join(''));
}

/**
 * Sheared right, more the higher up the row is - an italic.
 *
 * Half a cell per row rather than one, because a five-row letter leaning five
 * columns is a letter lying down. The shear is what a bitmap font has instead
 * of a second table: the letters are the same letters.
 */
function slant(rows: Grid): Grid {
  const height = rows.length;
  return rows.map((row, y) => ' '.repeat(Math.floor((height - 1 - y) / 2)) + row);
}

/**
 * The letter, and a second copy of it down and to the right in `%`.
 *
 * Two rules, and the second is the one that took a try to get right. The
 * letter is drawn over the shadow, so where they overlap the letter wins. And
 * the shadow is kept only *outside* the letter - the counter of an `A` is
 * enclosed, a real shadow could not fall into it, and one that did turned a
 * five-row capital into a smudge. `outside` is a flood fill from the border,
 * which is the cheapest way to ask whether a hole is a hole.
 */
function shadow(rows: Grid): Grid {
  const height = rows.length + 1;
  const width = (rows[0] as string).length + 1;
  const lit = (y: number, x: number): boolean =>
    y >= 0 && y < rows.length && x >= 0 && x < (rows[y] as string).length
    && (rows[y] as string)[x] !== ' ';

  const open = outside(height, width, (y, x) => lit(y, x));
  const out: string[][] = Array.from({ length: height }, () => Array.from({ length: width }, () => ' '));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (lit(y - 1, x - 1) && open[y * width + x]) (out[y] as string[])[x] = '%';
    }
  }
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < (rows[y] as string).length; x++) {
      if (lit(y, x)) (out[y] as string[])[x] = '#';
    }
  }
  return out.map((row) => row.join(''));
}

/** Which blank cells a flood fill from the border can reach. */
function outside(height: number, width: number, lit: (y: number, x: number) => boolean): boolean[] {
  const open = new Array<boolean>(height * width).fill(false);
  const queue: [number, number][] = [];
  const push = (y: number, x: number): void => {
    if (y < 0 || y >= height || x < 0 || x >= width) return;
    if (open[y * width + x] || lit(y, x)) return;
    open[y * width + x] = true;
    queue.push([y, x]);
  };
  for (let x = 0; x < width; x++) { push(0, x); push(height - 1, x); }
  for (let y = 0; y < height; y++) { push(y, 0); push(y, width - 1); }
  while (queue.length > 0) {
    const [y, x] = queue.pop() as [number, number];
    push(y - 1, x); push(y + 1, x); push(y, x - 1); push(y, x + 1);
  }
  return open;
}

// ------------------------------------------------------------------ fonts

export interface Font {
  id: string;
  title: string;
  /** What is different about it, for the panel under the list. */
  note: string;
  glyphs: Record<string, Grid>;
  /** Columns between two letters. */
  tracking: number;
  /** Columns a word space takes. */
  space: number;
}

export const FONTS: Font[] = [
  {
    id: 'block',
    title: 'block',
    note: 'The hand-drawn table: five rows, one cell to a stroke, both cases on one baseline.',
    glyphs: BLOCK,
    tracking: 1,
    space: 3,
  },
  {
    id: 'wide',
    title: 'wide',
    note: 'The same table with every column drawn twice. Twice the letter, the same shape - and twice as much of it for a ramp to run across.',
    glyphs: mapGlyphs(BLOCK, wide),
    tracking: 2,
    space: 4,
  },
  {
    id: 'slant',
    title: 'slant',
    note: 'The same table sheared half a column per row. A bitmap font gets its italic the way it gets everything else: by moving the cells.',
    glyphs: mapGlyphs(BLOCK, slant),
    tracking: 1,
    space: 3,
  },
  {
    id: 'shadow',
    title: 'shadow',
    note: "The same table twice: the letter, and a copy of it one cell down and right in a second glyph. Two characters in one block, which an ink colours without being told there are two.",
    glyphs: mapGlyphs(BLOCK, shadow),
    tracking: 1,
    space: 3,
  },
];

export function fontAt(id: string): Font {
  return FONTS.find((f) => f.id === id) ?? (FONTS[0] as Font);
}

/** The tallest glyph in a font, which is how many rows a line of it takes. */
export function heightOf(font: Font): number {
  return Object.values(font.glyphs).reduce((h, rows) => Math.max(h, rows.length), 0);
}

// ----------------------------------------------------------------- render

/** Blank edge columns removed, so a `1` is narrow and an `M` is wide. */
function trim(rows: Grid): Grid {
  const width = (rows[0] as string).length;
  let start = 0;
  let end = width - 1;
  const blank = (x: number): boolean => rows.every((row) => row[x] === ' ');
  while (start < width && blank(start)) start++;
  while (end >= start && blank(end)) end--;
  return rows.map((row) => row.slice(start, end + 1));
}

/**
 * Text as block letters.
 *
 * `fill` and `shade` are the characters the ink and its shadow are drawn in,
 * and they come from the caller rather than from here: an ascii terminal has
 * no full block, and a font that hardcoded one would put a row of question
 * marks on the screen that needs the banner most.
 *
 * Newlines are lines: each one becomes its own block of rows, stacked with a
 * blank row between them so two lines of banner do not read as one. A
 * character with no glyph becomes a word space, so a missing one shows as a
 * gap the reader can see rather than silently closing up.
 */
export function banner(text: string, font: Font, fill = '#', shade = fill): string {
  const height = heightOf(font);
  return text
    .split('\n')
    .map((line) => bannerLine(line, font, height, fill, shade))
    .join('\n\n');
}

function bannerLine(text: string, font: Font, height: number, fill: string, shade: string): string {
  const rows: string[] = Array.from({ length: height }, () => '');
  let first = true;

  for (const char of Array.from(text)) {
    // A glyph of its own, or the other case's, or nothing. Folding to the
    // other case is what lets a font with one set of letters take either.
    const found = font.glyphs[char]
      ?? font.glyphs[char.toUpperCase()]
      ?? font.glyphs[char.toLowerCase()];
    if (char === ' ' || !found) {
      for (let y = 0; y < height; y++) rows[y] += ' '.repeat(font.space);
      first = true;
      continue;
    }
    // Bottom-aligned: a font whose glyphs are not all the same height - the
    // shadow one is a row taller - has to agree about where the baseline is.
    const glyph = trim(found);
    const drop = height - glyph.length;
    for (let y = 0; y < height; y++) {
      const row = y < drop ? ' '.repeat((glyph[0] as string).length) : (glyph[y - drop] as string);
      rows[y] += (first ? '' : ' '.repeat(font.tracking)) + row;
    }
    first = false;
  }

  // Blank rows off the top and the bottom, so a line of nothing but x-height
  // letters is four rows rather than five with a gap over it. Per line, which
  // is the unit that is stacked - the letters inside one still share a
  // baseline, and that is the alignment that has to hold.
  const drawn = rows.map((row) => row.replace(/#/g, fill).replace(/%/g, shade).trimEnd());
  while (drawn.length > 0 && drawn[0] === '') drawn.shift();
  while (drawn.length > 0 && drawn[drawn.length - 1] === '') drawn.pop();
  return drawn.join('\n');
}

/**
 * What the letters are drawn in, and what their shadow is.
 *
 * The progress glyphs, because they are already the pair this needs: a full
 * cell and a lighter one, stated per theme and downgraded to `#` and `-` where
 * the terminal is ascii. The theme has made that choice and the example has no
 * business making it again - a font that hardcoded a full block would put a
 * row of question marks on the screen that needs the banner most.
 */
export function fillGlyphs(glyphs: { progressFull: string; progressEmpty: string }): {
  fill: string;
  shade: string;
} {
  return { fill: glyphs.progressFull, shade: glyphs.progressEmpty };
}
