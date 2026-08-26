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
 * Fifteen punctuation marks are mapped and five are not. The source lists them
 * with nothing saying which is which, and most of the shapes say it themselves
 * - a `▄█▄█▄` stacked twice is a `#` and nothing else - but five are a pair of
 * brackets and a pair of slashes whose direction is a guess. Guessing there
 * would put a `{` where a `/` belongs and look deliberate; leaving them out
 * makes them render as their own ascii character, which is visible, obviously
 * not part of the font, and says exactly what is absent.
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
  "(": ["░█▀░","░█░░","░▀▀░"],
  ")": ["░▀█░","░░█░","░▀▀░"],
  "_": ["░░░░","░░░░","░▀▀▀"],
  "+": ["░░░░","░▄█▄","░░▀░"],
  "-": ["░░░░","░▄▄▄","░░░░"],
  "=": ["░░░░","░▀▀▀","░▀▀▀"],
  "\"": ["░▀░▀","░░░░","░░░░"],
  "'": ["░▀","░░","░░"],
  " ": ["░░░░","░░░░","░░░░"],};
