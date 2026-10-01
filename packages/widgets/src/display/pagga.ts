/**
 * The `pagga` table, transcribed.
 *
 * Three rows of half cells on a `░` ground - which is the difference between
 * this and `half`, and the whole reason for it. `half` draws letters and
 * leaves the space around them empty; this draws them *on* something, so the
 * banner is a block of texture with the letters knocked out of it rather than
 * strokes floating on the terminal's background.
 *
 * That ground is why the glyphs are four columns rather than three. The first
 * column of every one is the `░` gutter, so the letters butt together and the
 * ground runs unbroken between them - and why the space is a glyph of its own
 * rather than a gap, because a gap would be a hole in it.
 *
 * One case: the source has one set of letters and lowercase folds to it.
 *
 * The punctuation comes from two places and the table says which is which. The
 * marks above the divider are transcribed - and the brackets among them took a
 * correction, because the source lists three pairs with nothing saying which is
 * which and shape alone does not settle it: the square-cornered pair reads as
 * `(` `)` just as happily as `[` `]`, and it was the wrong one of the two.
 *
 * The marks below it are drawn to match, because the source has none of them
 * at all - no full stop, no comma, no slash. Which is worth knowing when one
 * of them looks out of place: it is not a transcription error, it is a
 * judgement, and a paste would replace it.
 */
export const PAGGA: Record<string, string[]> = {
  0: ["░▄▀▄","░█/█","░░▀░"],
  1: ["░▀█░","░░█░","░▀▀▀"],
  2: ["░▀▀▄","░▄▀░","░▀▀▀"],
  3: ["░▀▀█","░░▀▄","░▀▀░"],
  4: ["░█░█","░░▀█","░░░▀"],
  5: ["░█▀▀","░▀▀▄","░▀▀░"],
  6: ["░▄▀▀","░█▀▄","░░▀░"],
  7: ["░▀▀█","░▄▀░","░▀░░"],
  8: ["░▄▀▄","░▄▀▄","░░▀░"],
  9: ["░▄▀▄","░░▀█","░▀▀░"],
  A: ["░█▀█","░█▀█","░▀░▀"],
  B: ["░█▀▄","░█▀▄","░▀▀░"],
  C: ["░█▀▀","░█░░","░▀▀▀"],
  D: ["░█▀▄","░█░█","░▀▀░"],
  E: ["░█▀▀","░█▀▀","░▀▀▀"],
  F: ["░█▀▀","░█▀▀","░▀░░"],
  G: ["░█▀▀","░█░█","░▀▀▀"],
  H: ["░█░█","░█▀█","░▀░▀"],
  I: ["░▀█▀","░░█░","░▀▀▀"],
  J: ["░▀▀█","░░░█","░▀▀░"],
  K: ["░█░█","░█▀▄","░▀░▀"],
  L: ["░█░░","░█░░","░▀▀▀"],
  M: ["░█▄█","░█░█","░▀░▀"],
  N: ["░█▀█","░█░█","░▀░▀"],
  O: ["░█▀█","░█░█","░▀▀▀"],
  P: ["░█▀█","░█▀▀","░▀░░"],
  Q: ["░▄▀▄","░█\\█","░░▀\\"],
  R: ["░█▀▄","░█▀▄","░▀░▀"],
  S: ["░█▀▀","░▀▀█","░▀▀▀"],
  T: ["░▀█▀","░░█░","░░▀░"],
  U: ["░█░█","░█░█","░▀▀▀"],
  V: ["░█░█","░▀▄▀","░░▀░"],
  W: ["░█░█","░█▄█","░▀░▀"],
  X: ["░█░█","░▄▀▄","░▀░▀"],
  Y: ["░█░█","░░█░","░░▀░"],
  Z: ["░▀▀█","░▄▀░","░▀▀▀"],
  "!": ["░█","░▀","░▀"],
  "?": ["░▄▀▄","░█▀▀","░░▀░"],
  "#": ["░▄█▄█▄","░▄█▄█▄","░░▀░▀░"],
  "$": ["░▄█▀","░▀██","░▀▀░"],
  "%": ["░▀░█","░▄▀░","░▀░▀"],
  "&": ["░▄▀░","░▄█▀","░░▀▀"],
  "*": ["░▄░▄","░▄█▄","░▄▀▄"],
  "[": ["░█▀░","░█░░","░▀▀░"],
  "]": ["░▀█░","░░█░","░▀▀░"],
  "_": ["░░░░","░░░░","░▀▀▀"],
  "+": ["░░░░","░▄█▄","░░▀░"],
  "-": ["░░░░","░▄▄▄","░░░░"],
  "=": ["░░░░","░▀▀▀","░▀▀▀"],
  "\"": ["░▀░▀","░░░░","░░░░"],
  "'": ["░▀","░░","░░"],
  "(": ["░▄▀░","░█░░","░░▀░"],
  ")": ["░▀▄░","░░█░","░▀░░"],
  "{": ["░░█▀","░▀▄░","░░▀▀"],
  "}": ["░▀█░","░░▄▀","░▀▀░"],
  "<": ["░░▄▀","░▀▄░","░░░▀"],
  ">": ["░▀▄░","░░▄▀","░▀░░"],
  " ": ["░░░░","░░░░","░░░░"],

  // Drawn to match, not transcribed: the source has none of these. A period
  // is the top half of the last cell, sitting on the line, and a comma is the
  // bottom half of it, hanging below - which is what those two marks are.
  ".": ["░░","░░","░▀"],
  ",": ["░░","░░","░▄"],
  ":": ["░░","░▀","░▀"],
  ";": ["░░","░▀","░▄"],
  "/": ["░░▄▀","░▄▀░","░▀░░"],
  "\\": ["░▀▄░","░░▀▄","░░░▀"],
  "@": ["░▄▀▄","░█▄█","░░▀▀"],
  "^": ["░▄▀▄","░░░░","░░░░"],
  "`": ["░▀▄","░░░","░░░"],
  "|": ["░█","░█","░▀"],
  "~": ["░░░░","░▄▀▄","░░░░"],
};
