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
 * A glyph is a grid of characters. Four of them are placeholders the renderer
 * fills in from the theme - `#` a full cell, `%` a lighter one, `^` the top
 * half of a cell and `v` the bottom half - and every other character is drawn
 * as itself, which is what lets `dots`, `stars` and `mini` be made of dots,
 * stars and pipes rather than of blocks. A space is nothing. Blank columns at
 * either edge are trimmed when a glyph is used, so the letters are
 * proportional rather than a fixed pitch.
 */

import { graphemeWidth, stringWidth } from '@textui/core';
import { GARD } from './gard.js';
import { PAGGA } from './pagga.js';

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
 * **One x-height, for all of them.** The body of every lowercase letter sits
 * on rows two to five and the ascenders reach up into row one, so the two
 * cases share a baseline and a cap is visibly taller than an x - which is the
 * whole reason for a second set rather than folding the case away. Letting an
 * `e` be four rows while the `o` beside it was three is what made `Hello` read
 * as a ransom note, and it is the kind of thing only a rendered alphabet shows.
 *
 * Nothing descends below the baseline: five rows is not enough to put a tail
 * under a `g` and keep the line spacing honest, so `g` and `y` hook left
 * instead - which is also what keeps `g` from being a `q`.
 */
const LOWER: Record<string, string> = {
  a: '    | ###|#  #|#  #| ###',
  b: '#   |### |#  #|#  #|### ',
  c: '    | ###|#   |#   | ###',
  d: '   #| ###|#  #|#  #| ###',
  e: '    | ## |#  #|### | ###',
  f: '  ##| #  |### | #  | #  ',
  g: '    | ###|#  #| ###|##  ',
  h: '#   |### |#  #|#  #|#  #',
  i: ' # |   | # | # | # ',
  j: '  # |    |  # |  # |##  ',
  k: '#   |#  #|##  |# # |#  #',
  l: '##  | #  | #  | #  |### ',
  m: '     |#####|# # #|# # #|# # #',
  n: '    |### |#  #|#  #|#  #',
  o: '    | ## |#  #|#  #| ## ',
  p: '    |### |#  #|### |#   ',
  q: '    | ###|#  #| ###|   #',
  r: '    |# ##|##  |#   |#   ',
  s: '    | ###|##  |  ##|### ',
  t: ' #  |### | #  | #  | #  ',
  u: '    |#  #|#  #|#  #| ###',
  v: '    |#  #|#  #| ## |  # ',
  w: '     |#   #|# # #|# # #| # # ',
  x: '    |#  #| ## | ## |#  #',
  y: '    |#  #|#  #| ###|##  ',
  z: '    |####|  # | #  |####',
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
  '(': '  #| # | # | # |  #',
  ')': '#  | # | # | # |#  ',
  "'": ' # | # |   |   |   ',
  '"': '# #|# #|   |   |   ',
  '#': ' # # |#####| # # |#####| # # ',
  '@': ' ### |#   #|# ## |#    | ### ',
  '&': ' ##  |##   | ### |#  # | ## #',
  '<': '  #| # |#  | # |  #',
  '>': '#  | # |  #| # |#  ',
  '$': ' ####|# #  | ### |  # #|#### ',
  '%': '#   #|   # |  #  | #   |#   #',
  '[': '### |#   |#   |#   |### ',
  ']': ' ###|   #|   #|   #| ###',
  '^': '  #  | # # |#   #|     |     ',
  '`': '#   | #  |    |    |    ',
  '{': '  ##| #  |##  | #  |  ##',
  '|': '#|#|#|#|#',
  '}': '##  |  # |  ##|  # |##  ',
  '~': '     | ##  |#  ##|     |     ',
  '_': '    |    |    |    |####',
};

/** The one hand-drawn table: every glyph, in both cases. */
const BLOCK: Record<string, Grid> = Object.fromEntries(
  Object.entries({ ...CAPS, ...LOWER, ...REST }).map(([key, spec]) => [key, pad(spec.split('|'))]),
);

/**
 * A second hand-drawn table: three rows, and drawn in strokes rather than in
 * cells.
 *
 * Three rows of *solid* cells cannot hold an alphabet - at that size an `A` and
 * an `M` are the same three-by-three block, and so are `G` and `O`. The way out
 * is the one every small figlet font takes: stop filling cells and start
 * drawing strokes, so a `|` and a `/` and a `\` each carry a direction the cell
 * on its own could not. That is why this table is characters rather than `#`,
 * and why it needs no placeholder - it is already what it looks like.
 *
 * One case. At three rows there is no room under a cap for an x-height, so
 * lowercase folds to these; `banner` does the folding.
 */
const MINI: Record<string, Grid> = {
  A: [' _ ', '|_|', '| |'],
  B: [' _ ', '|_)', '|_)'],
  C: [' _ ', '/  ', '\\_ '],
  D: [' _ ', '| \\', '|_/'],
  E: [' _ ', '|_ ', '|_ '],
  F: [' _ ', '|_ ', '|  '],
  G: [' _ ', '/ _', '\\_|'],
  H: ['   ', '|_|', '| |'],
  I: [' _ ', ' | ', ' | '],
  J: [' _ ', '  |', '._|'],
  K: ['   ', '|/ ', '|\\ '],
  L: ['   ', '|  ', '|_ '],
  M: ['    ', '|\\/|', '|  |'],
  N: ['    ', '|\\ |', '| \\|'],
  O: [' _ ', '/ \\', '\\_/'],
  P: [' _ ', '|_)', '|  '],
  Q: [' _ ', '/ \\', '\\_\\'],
  R: [' _ ', '|_)', '| \\'],
  S: [' _ ', '(_ ', '._)'],
  T: ['___', ' | ', ' | '],
  U: ['   ', '| |', '╰─╯'],
  V: ['    ', '\\  /', ' \\/ '],
  W: ['    ', '|  |', '|\\/|'],
  X: ['   ', '\\ /', '/ \\'],
  Y: ['   ', '\\ /', ' | '],
  Z: ['___', ' / ', '/_ '],
  // Struck through, or it is the letter `O` again.
  0: [' _ ', '/|\\', '\\_/'],
  1: ['   ', ' /|', '  |'],
  2: [' _ ', ' _)', '(_ '],
  3: [' _ ', ' _)', ' _)'],
  4: ['   ', '|_|', '  |'],
  5: [' _ ', '|_ ', ' _)'],
  6: [' _ ', '/_ ', '(_)'],
  7: ['___', '  /', ' / '],
  8: [' _ ', '(_)', '(_)'],
  9: [' _ ', '(_)', ' _/'],
  '!': [' ', '|', '.'],
  '?': [' _ ', ' _)', ' . '],
  '.': ['  ', '  ', '. '],
  ',': ['  ', '  ', ', '],
  ':': ['  ', '. ', '. '],
  ';': ['  ', '. ', ', '],
  '-': ['   ', '___', '   '],
  '+': ['   ', ' + ', '   '],
  '=': [' _ ', '___', '   '],
  '/': ['   ', '  /', ' / '],
  "'": ['| ', '  ', '  '],
  '(': [' /', '| ', ' \\'],
  ')': ['\\ ', ' |', '/ '],
  '_': ['   ', '   ', '___'],

  // The rest of printable ascii, in the same strokes. `$ % & @` are not here:
  // at three rows there is no stroke that says "dollar" rather than "S with a
  // line", and a stand-in that says `$` is more use than one that lies.
  '"': ['||', '  ', '  '],
  '#': ['_|_|', '_|_|', ' | |'],
  '*': ['   ', '\\|/', '/|\\'],
  '<': [' /', '< ', ' \\'],
  '>': ['\\ ', ' >', '/ '],
  '[': ['|-', '| ', '|_'],
  ']': ['-|', ' |', '_|'],
  '{': [' /', '{ ', ' \\'],
  '}': ['\\ ', ' }', '/ '],
  '\\': ['\\  ', ' \\ ', '  \\'],
  '^': ['/\\', '  ', '  '],
  '`': ['\\ ', '  ', '  '],
  '|': ['|', '|', '|'],
  '~': ['   ', '/\\/', '   '],
};


/**
 * A third table: three rows of heavy box-drawing.
 *
 * The capitals are transcribed from a font Softov brought, character for
 * character - which is why `X` is four cells wide and `I` is one, and why they
 * are not going to be tidied into a grid. The digits and the punctuation are
 * drawn to match rather than transcribed, because the source had none.
 *
 * One case, and it is the only font here that cannot be drawn at all on an
 * ascii terminal - box-drawing has no `#` to fall back to the way a block does,
 * so this one names `mini` as what to use instead. Same three rows, same
 * stroke-drawn idea, characters a teletype could manage.
 */
const TMPLT: Record<string, Grid> = {
  A: ["┏┓", "┣┫", "┛┗"],
  B: ["┳┓", "┣┫", "┻┛"],
  C: ["┏┓", "┃ ", "┗┛"],
  D: ["┳┓", "┃┃", "┻┛"],
  E: ["┏┓", "┣ ", "┗┛"],
  F: ["┏┓", "┣ ", "┻ "],
  G: ["┏┓", "┃┓", "┗┛"],
  H: ["┓┏", "┣┫", "┛┗"],
  I: ["┳", "┃", "┻"],
  J: ["┏┳", " ┃", "┗┛"],
  K: ["┓┏┓", "┃┫ ", "┛┗┛"],
  L: ["┓ ", "┃ ", "┗┛"],
  M: ["┳┳┓", "┃┃┃", "┛ ┗"],
  N: ["┳┓", "┃┃", "┛┗"],
  O: ["┏┓", "┃┃", "┗┛"],
  P: ["┏┓", "┃┃", "┣┛"],
  Q: ["┏┓", "┃┃", "┗┻"],
  R: ["┳┓", "┣┫", "┛┗"],
  S: ["┏┓", "┗┓", "┗┛"],
  T: ["┏┳┓", " ┃ ", " ┻ "],
  U: ["┳┳", "┃┃", "┗┛"],
  V: ["┓┏", "┃┃", "┗┛"],
  W: ["┓ ┏", "┃┃┃", "┗┻┛"],
  X: ["┏┓┏┓", " ┃┃ ", "┗┛┗┛"],
  Y: ["┓┏", "┗┫", "┗┛"],
  Z: ["┏┓", "┏┛", "┗┛"],
  // Drawn to match, not transcribed. `0` keeps `O`'s shape, which is what a
  // font this small usually does with them.
  // A slash through it, or a zero and a letter `O` are the same glyph.
  0: ["┏┓", "┃╋", "┗┛"],
  1: [" ┓", " ┃", " ┻"],
  2: ["┏┓", "┏┛", "┗┻"],
  3: ["┏┓", " ┫", "┗┛"],
  4: ["┓┏", "┗╋", " ┃"],
  5: ["┏┳", "┗┓", "┗┛"],
  6: ["┏┓", "┣┓", "┗┛"],
  7: ["┳┳", " ┃", " ┛"],
  8: ["┏┓", "┣┫", "┗┛"],
  9: ["┏┓", "┗┫", "┗┛"],
  'a': [
    "",
    "┏┓",
    "┗┻"
    // "   ", 
    // "┏┓ ", 
    // "┗┻┛"
  ],
  'b': [
    "┓ ",
    "┣┓",
    "┗┛"
  ],
  'c': [
    "",
    "┏",
    "┗"
  ],
  'd': [
    " ┓",
    "┏┫",
    "┗┻"
  ],
  'e': [
    "",
    "┏┓",
    "┗"
  ],
  'f': [
    " ┏",
    " ╋",
    " ┛"
  ],
  'g': [
    "",
    "┏┓",
    "┗┫",
    " ┛"
  ],
  'h': [
    "┓ ",
    "┣┓ ",
    "┛┗ ",
  ],
  'i': [
    "•",
    "┓ ",
    "┗ ",
  ],
  'j': [
    "• ",
    "┓ ",
    "┃ ",
    "┛ ",
  ],
  'k': [
    "┓ ",
    "┃┏",
    "┛┗",
  ],
  'l': [
    "┓ ",
    "┃ ",
    "┗ ",
  ],
  'm': [
    "",
    "┏┳┓",
    "┛┗┗",
  ],
  'n': [
    "",
    "┏┓ ",
    "┛┗ ",
  ],
  'o': [
    "",
    "┏┓",
    "┗┛",
  ],
  'p': [
    "",
    "┏┓",
    "┣┛",
    "┛ ",
  ],
  'q': [
    "",
    "┏┓",
    "┗┫",
    " ┗",
  ],
  'r': [
    "",
    "┏┓",
    "┛ ",
  ],
  's': [
    "",
    "┏ ",
    "┛ ",
  ],
  't': [
    "",
    "╋ ",
    "┗ ",
  ],
  'u': [
    "",
    "┓┏",
    "┗┻",
  ],
  'v': [
    "",
    "┓┏",
    "┗┛",
  ],
  'w': [
    "",
    "┓┏┏",
    "┗┻┛",
  ],
  'x': [
    "",
    "┓┏",
    "┛┗",
  ],
  'y': [
    " ",
    "┓┏",
    "┗┫",
    " ┛"
  ],
  'z': [
    "",
    "┓",
    "┗",
  ],
  '.': [" ", " ", "•"],
  ',': [" ", " ", "┛"],
  ':': [" ", "•", "•"],
  ';': [" ", "•", "┛"],
  '!': ["┃", "┃", "•"],
  '?': ["┏┓", " ┛", " •"],
  '@': ["┏━┓", "┃┗┛", "┗━┛"],
  '-': ["  ", "━━", "  "],
  '+': ["  ", "╋ ", "  "],
  '=': ["  ", "━━", "━━"],
  '/': [" ┏", "┏┛", "┛ "],
  "'": ["┃", " ", " "],
  '(': ["┏", "┃", "┗"],
  ')': ["┓", "┃", "┛"],
  '_': ["  ", "  ", "━━"],

  // Also drawn to match. `$ % & @ *` are left out: box-drawing has no stroke
  // for any of them, and a `╋` standing in for a `*` is a plus sign lying.
  '"': ["┃┃", "  ", "  "],
  '#': ["╋╋", "╋╋", "  "],
  '<': [" ┏", "┫ ", " ┗"],
  '>': ["┓ ", " ┣", "┛ "],
  // The square pair takes a bar off each corner, so it is not the round pair
  // drawn a second time - which is what it was until a test said so.
  '[': ["┏━", "┃ ", "┗━"],
  ']': ["━┓", " ┃", "━┛"],
  '{': ["┏", "┫", "┗"],
  '}': ["┓", "┣", "┛"],
  '\\': ["┓ ", "┗┓", " ┛"],
  '^': ["┏┓", "  ", "  "],
  '`': ["┓ ", "  ", "  "],
  '|': ["┃", "┃", "┃"],
  '~': ["  ", "┏┛", "  "],
};

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

/**
 * Two rows of the table to one row of output, as half cells.
 *
 * The only transform that changes the *height*: five rows become three, and a
 * banner that would not fit a short terminal does. A cell is full where both
 * source rows are lit, a top or a bottom half where one is, and nothing where
 * neither - which is four characters standing in for four combinations, and
 * why it is a substitution rather than a redrawing.
 */
function half(rows: Grid): Grid {
  const width = (rows[0] as string).length;
  const out: string[] = [];
  for (let y = 0; y < rows.length; y += 2) {
    let line = '';
    for (let x = 0; x < width; x++) {
      const top = (rows[y] as string)[x] !== ' ';
      const bottom = y + 1 < rows.length && (rows[y + 1] as string)[x] !== ' ';
      line += top && bottom ? '#' : top ? '^' : bottom ? 'v' : ' ';
    }
    out.push(line);
  }
  return out;
}

/**
 * Drawn in dots and colons rather than in blocks.
 *
 * A cell takes the character of the stroke that owns it, and the two strokes
 * that can both claim a cell are settled by one question: **does anything come
 * down into it?**
 *
 *   * a neighbour across, and nothing above - the bar owns it, a dot;
 *   * anything else with a neighbour above or below - a stem owns it, a colon;
 *   * neither - a dot, which is what a diagonal and a full stop are made of.
 *
 * Both halves of that were learnt the hard way and neither is arbitrary. Ask
 * about the vertical first and the top bar of a `T` comes out `..:..`, because
 * the stem hangs off its middle - but a stem hanging *below* a bar does not
 * take a cell out of the bar. Ask only about the horizontal and the bottom bar
 * of an `I` comes out `.....`, because the stem is above it - and a stem
 * landing *on* a bar does show where it lands. A `T` and an `I` are the same
 * two strokes; which one wins depends on which way the stem runs.
 *
 * The letters are the same letters. This is a change of pen, not of hand, which
 * is why it is twenty lines.
 */
function dots(rows: Grid): Grid {
  // Both bounds, on both axes. Indexing a string past its end gives
  // `undefined`, and `undefined !== ' '` reads as lit - so the last column of
  // every row believed it had a neighbour to the right.
  const lit = (y: number, x: number): boolean =>
    y >= 0 && y < rows.length
    && x >= 0 && x < (rows[y] as string).length
    && (rows[y] as string)[x] !== ' ';

  return rows.map((row, y) => Array.from(row)
    .map((cell, x) => {
      if (cell === ' ') return ' ';
      const across = lit(y, x - 1) || lit(y, x + 1);
      if (across && !lit(y - 1, x)) return '.';
      return lit(y - 1, x) || lit(y + 1, x) ? ':' : '.';
    })
    .join(''));
}

/** Every lit cell a star with a gap after it, which is `wide` with one column of two drawn. */
function stars(rows: Grid): Grid {
  return rows.map((row) => Array.from(row).map((c) => (c === ' ' ? '  ' : '* ')).join(''));
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
  /**
   * Two sets of letters, or one.
   *
   * Everything off the five-row table has `both`, because the table does and a
   * transform of it cannot lose a case. `mini` has one set and folds - at three
   * rows there is no room under a cap for an x-height.
   */
  cases: 'both' | 'folded';
  /**
   * Whether this font's glyphs are written in placeholders.
   *
   * The ones off the five-row table are: `#` and `%` and the two halves, filled
   * in from the theme at paint time. The hand-drawn tables are not - they are
   * already what they look like - and it matters, because a literal `#` in one
   * of them would otherwise be swapped for a full block, which is how the
   * character `#` would come out as a solid bar.
   */
  placeholders?: boolean;
  /**
   * Which row of the glyph box the letters sit on.
   *
   * Only needed where it is not the last one: `gard` keeps two blank rows
   * under its baseline for the descenders, so a character drawn on the last
   * row would hang below every letter beside it. Used for the stand-in a
   * missing character gets, which has to land on the line like anything else.
   */
  baseline?: number;
  /**
   * The font to draw instead where this one's characters do not exist.
   *
   * Only `tmplt` needs one. Every other font here is made of placeholders the
   * theme fills in, or of characters a teletype has - box-drawing is neither,
   * and there is no `#` to downgrade a `┏` to. So it names a stand-in of the
   * same height rather than putting a row of question marks on the screen.
   */
  fallback?: string;
}

export const FONTS: Font[] = [
  {
    id: 'block',
    title: 'block',
    note: 'The hand-drawn table: five rows, one cell to a stroke, both cases on one baseline.',
    glyphs: BLOCK,
    tracking: 1,
    space: 3,
    placeholders: true,
    cases: 'both',
  },
  {
    id: 'wide',
    title: 'wide',
    note: 'The same table with every column drawn twice. Twice the letter, the same shape - and twice as much of it for a ramp to run across.',
    glyphs: mapGlyphs(BLOCK, wide),
    tracking: 2,
    space: 4,
    placeholders: true,
    cases: 'both',
  },
  {
    id: 'slant',
    title: 'slant',
    note: 'The same table sheared half a column per row. A bitmap font gets its italic the way it gets everything else: by moving the cells.',
    glyphs: mapGlyphs(BLOCK, slant),
    tracking: 1,
    space: 3,
    placeholders: true,
    cases: 'both',
  },
  {
    id: 'shadow',
    title: 'shadow',
    note: 'The same table twice: the letter, and a copy of it one cell down and right in a second glyph. Two characters in one block, which an ink colours without being told there are two.',
    glyphs: mapGlyphs(BLOCK, shadow),
    tracking: 1,
    space: 3,
    placeholders: true,
    cases: 'both',
  },
  {
    id: 'half',
    title: 'half',
    note: 'Two rows of the table to one row of half cells. The only transform that changes the height - five rows become three, and a banner that would not fit a short terminal does.',
    glyphs: mapGlyphs(BLOCK, half),
    tracking: 1,
    space: 3,
    placeholders: true,
    cases: 'both',
  },
  {
    id: 'dots',
    title: 'dots',
    note: 'A dot where a bar runs across, a colon where a stem runs down - and the junction goes to whichever one comes down into it. The same letters in a different pen.',
    glyphs: mapGlyphs(BLOCK, dots),
    tracking: 1,
    space: 3,
    cases: 'both',
  },
  {
    id: 'stars',
    title: 'stars',
    note: 'Every lit cell a star with a gap after it, which is `wide` with one column of the two drawn. Airy enough that a per-cell ink reads as a pattern rather than as a wash.',
    glyphs: mapGlyphs(BLOCK, stars),
    tracking: 2,
    space: 4,
    cases: 'both',
  },
  {
    id: 'pagga',
    title: 'pagga',
    note: 'Three rows of half cells on a shaded ground - the difference from half, and the point of it: the letters are knocked out of a block of texture rather than floating on the terminal.',
    glyphs: PAGGA,
    tracking: 0,
    space: 4,
    cases: 'folded',
    fallback: 'mini',
  },
  {
    id: 'gard',
    title: 'gard',
    note: 'Quotes, pipes and dots, transcribed glyph for glyph - the only font here with two cases of its own rather than a fold, and the only one with letters that hang below the baseline.',
    glyphs: GARD,
    tracking: 1,
    space: 3,
    baseline: 6,
    cases: 'both',
  },
  {
    id: 'tmplt',
    title: 'tmplt',
    note: 'Heavy box-drawing, transcribed capital for capital, with a lowercase drawn to match - three rows and a fourth for the tails of g, j, p, q and y. Nothing to fall back to on an ascii terminal, so it borrows mini there.',
    glyphs: TMPLT,
    tracking: 1,
    space: 2,
    // Row two, not row three: the box grew a fourth row for the descenders
    // and a stand-in belongs on the line the letters sit on, not on the one
    // their tails reach down to.
    baseline: 2,
    cases: 'both',
    fallback: 'mini',
  },
  {
    id: 'mini',
    title: 'mini',
    note: 'A second table, three rows, drawn in strokes rather than in cells - because at three rows a solid A and a solid M are the same block. One case: lowercase folds to it.',
    glyphs: MINI,
    tracking: 1,
    space: 2,
    cases: 'folded',
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

/**
 * The glyph for a character, or nothing.
 *
 * Its own, or the other case's - folding is what lets a font with one set of
 * letters take either - and trimmed of blank edge columns, so a `1` is narrow
 * and an `M` is wide. Shared by the drawing and the measuring, because a wrap
 * that measured a letter differently from the way it is drawn is a wrap that
 * is wrong by however much they disagree.
 */
function glyphOf(font: Font, char: string): Grid | undefined {
  if (invisible(char)) return undefined;
  const found = font.glyphs[char]
    ?? font.glyphs[char.toUpperCase()]
    ?? font.glyphs[char.toLowerCase()];
  if (found !== undefined) return trim(found);
  return char === ' ' ? undefined : standIn(font, char);
}

/**
 * A character the font has no glyph for, drawn as itself.
 *
 * Not a gap. A gap is indistinguishable from a space, so a font missing its
 * punctuation renders `hello, world!` as `hello  world` and looks like it
 * worked - the reader has no way to tell a missing glyph from a word break.
 * One cell with the character in it is legible, obviously not part of the
 * font, and says exactly which character is absent.
 *
 * On the baseline, so it sits on the line with the letters beside it rather
 * than under them.
 */
function standIn(font: Font, char: string): Grid {
  const height = heightOf(font);
  const line = font.baseline ?? height - 1;
  // Padded to the cells it actually occupies. A wide character is one string
  // index and two columns, and a stand-in measured by index put every letter
  // after it one column to the left of where it was drawn.
  const width = Math.max(1, stringWidth(char));
  return Array.from({ length: height }, (_, y) => (y === line ? char : ' '.repeat(width)));
}

/**
 * A character that draws nothing and takes no room, because it is not there.
 *
 * Zero-width and control characters arrive by paste - a byte-order mark off a
 * web page, a zero-width space out of a code block - and they used to come out
 * as a *word gap*, because a character with no glyph gets one. So `AB` pasted
 * with a joiner between the letters rendered as `A B`, and the banner had a
 * word break in it that the field it was typed in did not.
 *
 * Invisible in the text, invisible in the banner. It is the only reading that
 * cannot surprise anyone.
 */
const INVISIBLE = /^[\p{Cf}\p{Cc}\p{Mn}\p{Me}]$/u;

function invisible(char: string): boolean {
  return graphemeWidth(char) === 0 || INVISIBLE.test(char);
}

/**
 * A character that is a space, whatever its code point.
 *
 * A non-breaking space is a space: it arrives by paste out of anything that
 * has ever been near a web page, and it was drawing as a stand-in - one blank
 * cell where a word gap belonged, so the words either side ran together.
 */
const SPACE = /^\p{Zs}$/u;

/** The columns a character takes, not counting the gap before it. */
function widthOf(font: Font, char: string): number {
  if (invisible(char)) return 0;
  if (SPACE.test(char)) return font.space;
  const glyph = glyphOf(font, char);
  return glyph ? stringWidth(glyph[0] as string) : font.space;
}

/**
 * Blank edge columns removed, so a `1` is narrow and an `M` is wide.
 *
 * The width is the widest row and not the first one. A table written by hand
 * has rows of whatever length they happened to be typed at, and `gard` has a
 * blank first row on every letter - so taking row zero's length trimmed every
 * one of them to nothing at all.
 */
function trim(rows: Grid): Grid {
  const width = rows.reduce((w, row) => Math.max(w, row.length), 0);
  const padded = rows.map((row) => row.padEnd(width, ' '));
  let start = 0;
  let end = width - 1;
  const blank = (x: number): boolean => padded.every((row) => row[x] === ' ');
  while (start < width && blank(start)) start++;
  while (end >= start && blank(end)) end--;
  return padded.map((row) => row.slice(start, end + 1));
}

/**
 * The four characters a glyph's placeholders are drawn in.
 *
 * `fill` and `shade` are theme glyphs; the two halves are not, because the
 * theme has no name for half a cell. What they all share is that the *font*
 * names a role and something else decides what the terminal can show - which
 * is the rule the whole catalog follows, and the reason `half` degrades to
 * quotes and underscores instead of putting a row of question marks on the
 * screen that needs the banner most.
 */
export interface InkGlyphs {
  fill: string;
  shade: string;
  top: string;
  bottom: string;
}

export function inkGlyphs(
  glyphs: { progressFull: string; progressEmpty: string },
  unicode = true,
): InkGlyphs {
  return {
    fill: glyphs.progressFull,
    shade: glyphs.progressEmpty,
    top: unicode ? '▀' : '"',
    bottom: unicode ? '▄' : '_',
  };
}

/** What the fonts are drawn in where nothing has said otherwise. */
export const PLAIN_GLYPHS: InkGlyphs = { fill: '#', shade: '-', top: '"', bottom: '_' };

/**
 * Text as block letters.
 *
 * Newlines are lines: each one becomes its own block of rows, stacked with a
 * blank row between them so two lines of banner do not read as one. A
 * character with no glyph becomes a word space, so a missing one shows as a
 * gap the reader can see rather than silently closing up.
 */
export function banner(
  text: string,
  font: Font,
  ink: InkGlyphs = PLAIN_GLYPHS,
  width = Infinity,
): string {
  const height = heightOf(font);
  return text
    .split('\n')
    .flatMap((line) => wrapToWidth(line, font, width))
    .map((line) => bannerLine(line, font, height, ink))
    .join('\n\n');
}

/**
 * Break a line of text into lines that fit, measured in this font.
 *
 * The wrapping has to happen *here*, on the text, and not on the drawn block:
 * a line of block letters cut at column sixty is a line of half letters, and
 * five rows each cut in a different place is not a word at all. So the letters
 * are measured before they are drawn, and the break goes between them.
 *
 * Words first, characters only when one word cannot fit on a line of its own -
 * because breaking `Deployment` in half is bad and dropping the second half is
 * worse, and one of those has to happen.
 */
function wrapToWidth(text: string, font: Font, width: number): string[] {
  if (!Number.isFinite(width) || width <= 0) return [text];

  const lines: string[] = [];
  let line = '';
  let used = 0;
  const flush = (): void => { lines.push(line); line = ''; used = 0; };

  /**
   * Put a piece on the line, or on the next one.
   *
   * `sep` is the gap it needs from what is already there - a word space
   * between words, tracking between the letters of one word - and `gap` is
   * what that gap is spelled as in the text, which is a space for the first
   * and nothing for the second.
   */
  const add = (piece: string, cost: number, sep: number, gap: string): void => {
    if (line !== '' && used + sep + cost > width) flush();
    if (line === '') { line = piece; used = cost; return; }
    line += gap + piece;
    used += sep + cost;
  };

  for (const word of text.split(' ')) {
    const cost = costOf(word, font);
    if (cost === 0) continue;
    if (cost <= width) { add(word, cost, font.space, ' '); continue; }
    // Wider than a whole line even on its own, so it is spent a character at a
    // time - starting in whatever room is left on this line rather than on a
    // fresh one, because a line holding three letters and a lot of air is not
    // an improvement on a broken word.
    let first = true;
    for (const char of Array.from(word)) {
      add(char, widthOf(font, char), first ? font.space : font.tracking, first ? ' ' : '');
      first = false;
    }
  }
  if (line !== '' || lines.length === 0) lines.push(line);
  return lines;
}

/** The columns a word takes, letters and the tracking between them. */
function costOf(word: string, font: Font): number {
  // Invisible characters are dropped before the tracking is counted, or a
  // word of nothing but a byte-order mark would still be charged for the gaps
  // between the letters it does not have.
  const chars = Array.from(word).filter((char) => !invisible(char));
  return chars.reduce((total, char, i) => total + (i === 0 ? 0 : font.tracking) + widthOf(font, char), 0);
}

function bannerLine(text: string, font: Font, height: number, ink: InkGlyphs): string {
  const rows: string[] = Array.from({ length: height }, () => '');
  let first = true;

  for (const char of Array.from(text)) {
    if (invisible(char)) continue;
    // A space is a gap unless the font draws one. `pagga` does: its ground has
    // to run through the gap between two words, and a gap would be a hole in
    // it - so the table has a glyph for `' '` and that glyph wins.
    const glyph = SPACE.test(char)
      ? (font.glyphs[' '] === undefined ? undefined : trim(font.glyphs[' ']))
      : glyphOf(font, char);
    if (!glyph) {
      for (let y = 0; y < height; y++) rows[y] += ' '.repeat(font.space);
      first = true;
      continue;
    }
    // Top-aligned: row nought of a glyph is row nought of the line, and a
    // glyph shorter than the font is short at the *bottom*.
    //
    // Which is what lets a descender be written as one row taller than
    // everything else and nothing else be touched. An `a` says where it starts
    // with a blank first row; a `g` says where it ends by having a fourth. Line
    // them up from the bottom instead and adding a tail to `g` silently pushes
    // every three-row capital down a row, so `A` comes to rest on the same line
    // as the tail rather than on the same line as the `g` itself.
    const width = glyph.reduce((w, row) => Math.max(w, row.length), 0);
    for (let y = 0; y < height; y++) {
      const row = y < glyph.length ? (glyph[y] as string) : ' '.repeat(width);
      rows[y] += (first ? '' : ' '.repeat(font.tracking)) + row;
    }
    first = false;
  }

  // Blank rows off the top and the bottom, so a line of nothing but x-height
  // letters is four rows rather than five with a gap over it. Per line, which
  // is the unit that is stacked - the letters inside one still share a
  // baseline, and that is the alignment that has to hold.
  // Only where the font said its glyphs are placeholders. A hand-drawn table
  // is already what it looks like, and running this over one would turn its
  // literal `#` into a full block and its `v` into half a cell.
  const ink_ = (row: string): string => (font.placeholders
    ? row.replace(/#/g, ink.fill).replace(/%/g, ink.shade)
      .replace(/\^/g, ink.top).replace(/v/g, ink.bottom)
    : row);
  const drawn = rows.map((row) => ink_(row).trimEnd());
  while (drawn.length > 0 && drawn[0] === '') drawn.shift();
  while (drawn.length > 0 && drawn[drawn.length - 1] === '') drawn.pop();
  return drawn.join('\n');
}
