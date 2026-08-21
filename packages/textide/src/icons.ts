/**
 * Every icon textide draws, in one place.
 *
 * Two reasons this is a file rather than a literal at each call site. The
 * obvious one is that fifteen scattered glyphs drift - `▤` was Layout in one
 * command and Toggle Sidebar in another, which nobody would have written on
 * purpose. The other is that a terminal is a grid, and an icon that is two
 * cells wide silently pushes every row it appears in out of alignment.
 *
 * So an icon here is a *single-cell* mark. `mono` asks for the text
 * presentation of a character that has one, which is what stops a picture
 * emoji from being drawn double-width - and `ICON_WIDTH_SAFE` proves it
 * rather than trusting it.
 */

/** Ask for the text presentation of a character that has both. */
const TEXT_PRESENTATION = '︎';

/**
 * A character that would otherwise be drawn as a colour emoji, asked to be
 * drawn as text instead.
 *
 * The selector is advisory: a terminal that only has the colour glyph will
 * still draw it, and draw it two cells wide. That is why nothing in this file
 * relies on one - `mono` is here for the handful of marks that genuinely read
 * better as emoji-derived symbols, and everything else is a plain symbol that
 * was never ambiguous.
 */
export function mono(glyph: string): string {
  return `${glyph}${TEXT_PRESENTATION}`;
}

export const Icon = {
  // --- files and the tree ------------------------------------------------
  folder: '▸',
  folderOpen: '▾',
  file: '▤',
  markdown: '¶',
  code: '⌗',
  data: '⌸',

  // --- the document ------------------------------------------------------
  save: '⌸',
  revert: '↺',
  close: '✕',
  edit: '✎',
  read: '◉',

  // --- creating and destroying -------------------------------------------
  newFile: '+',
  newFolder: '⊞',
  rename: '✎',
  delete: '⌫',

  // --- chrome and layout -------------------------------------------------
  //
  // The region marks are the theme's, not this file's: which edge a surface
  // sits on is a drawing question and the theme answers it. What is here is
  // the *concept* of layout, which is the thing a menu entry names.
  layout: '▦',
  arrangement: '▨',
  theme: '◐',
  sidebar: '◧',
  statusBar: '▁',
  titleBar: '▔',

  // --- finding and asking ------------------------------------------------
  palette: '⌕',
  search: '⌕',
  keys: '⌨',
  about: 'ℹ',

  // --- state -------------------------------------------------------------
  dirty: '●',
  readonly: '⊘',
  error: '✖',
  warning: '⚠',
  ok: '✓',
} as const;

export type IconName = keyof typeof Icon;

/**
 * The icons that are safe to put in a fixed-width column.
 *
 * Exported so a test can check the whole set at once instead of finding out
 * when a row is one cell wider than its neighbours. Anything that measures
 * wider than a cell belongs in prose, not in a gutter.
 */
export const ICON_WIDTH_SAFE: readonly IconName[] = Object.keys(Icon) as IconName[];
