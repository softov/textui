import type { UnicodeLevel } from '@textui/core';

/**
 * Every icon textide draws, in one place.
 *
 * Two reasons this is a file rather than a literal at each call site. The
 * obvious one is that fifteen scattered glyphs drift - `▤` was Layout in one
 * command and Toggle Sidebar in another, which nobody would have written on
 * purpose. The other is that a terminal is a grid, and an icon that is two
 * cells wide silently pushes every row it appears in out of alignment.
 *
 * These are textide's vocabulary, not the library's. `theme.glyphs` names the
 * roles a *component* draws - a chevron, a checkbox, which edge a region sits
 * on - and the theme owns those because the library draws them itself. It has
 * no business knowing what "rename" or "workspace" mean. Where the two meet,
 * the theme wins: the surface switches ask `theme.glyphs` which edge mark to
 * use rather than picking one here.
 *
 * What is borrowed from the theme is the *shape* of the answer. An icon has
 * three tiers for the same reason a glyph does, because the terminal that
 * cannot draw `⌸` is a real terminal and it should still be usable.
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

export const FULL_ICONS = {
  // --- files and the tree ------------------------------------------------
  //
  // Not chevrons. In a file tree the expand mark is also the only thing on the
  // row that says "folder" - a file has a size beside it and a folder has
  // nothing - so an arrow spends the one cell that could carry both on the one
  // meaning that is already obvious from the row moving.
  //
  // There is no folder glyph that is one cell wide and safe: the Unicode ones
  // live outside the BMP and measure two. A box that has something in it and a
  // box that has been opened is what fits.
  folder: '⊞',
  folderOpen: '⊟',
  file: '▤',
  markdown: '¶',
  code: '⌗',
  data: '⌸',

  // --- the document ------------------------------------------------------
  save: '⌸',
  revert: '↺',
  undo: '↶',
  redo: '↷',
  close: '✕',
  edit: '✎',
  read: '◉',

  // --- creating and destroying -------------------------------------------
  newFile: '+',
  newFolder: '⊕',
  rename: '✎',
  delete: '⌫',

  // --- chrome and layout -------------------------------------------------
  //
  // The region marks are the theme's, not this file's: which edge a surface
  // sits on is a drawing question and the theme answers it. What is here is
  // the *concept* of layout, which is the thing a menu entry names.
  layout: '▦',
  arrangement: '▨',
  split: '◫',
  theme: '◐',
  sidebar: '◧',
  statusBar: '▁',
  titleBar: '▔',

  // --- finding and asking ------------------------------------------------
  palette: '⌕',
  search: '⌕',
  go: '⇥',
  next: '›',
  previous: '‹',
  keys: '⌨',
  about: 'ℹ',
  camera: '⎙',

  // Not a plug and not a puzzle piece: both live outside the BMP and measure
  // two cells, which is the same trap the folder glyph fell into. A box with a
  // mark in it is what fits, and it is next to `layout` in shape on purpose -
  // an extension is a thing that adds a region, and it should look like one.
  extension: '▣',

  // --- state -------------------------------------------------------------
  //
  // The rule down the left of the main pane, which is the only thing on screen
  // saying where focus is. It was a `'\u258e'` written into the component -
  // exactly the drift this file exists to stop, and the one glyph that has to
  // survive an ASCII terminal because without it nothing marks the pane.
  activeRule: '▎',
  dirty: '●',
  readonly: '⊘',
  error: '✖',
  warning: '⚠',
  ok: '✓',
} as const;

export type IconName = keyof typeof FULL_ICONS;
export type IconSet = Record<IconName, string>;

/**
 * Geometric shapes, blocks and arrows only.
 *
 * The terminal this tier is for is the Linux console, whose font is a few
 * hundred glyphs: box drawing and blocks are there, dingbats and the APL
 * operators are not. So the marks that say *where* survive - a half-filled
 * square still reads as a sidebar - and the ones that say *what* fall back to
 * a letter, exactly as `check` becomes `√` in the theme.
 */
export const BMP_ICONS: IconSet = {
  ...FULL_ICONS,
  // The Linux console font is box drawing and blocks; the squared operators
  // are not in it. A filled box and a hollow one say the same thing.
  folder: '▪',
  folderOpen: '▫',
  code: '#',
  data: '≡',
  save: '≡',
  close: '×',
  edit: '±',
  newFolder: '□',
  rename: '±',
  split: '║',
  go: '→',
  next: '>',
  previous: '<',
  delete: '×',
  keys: '=',
  about: 'i',
  error: 'x',
  warning: '!',
  ok: '√',
  camera: '□',
};

/**
 * One printable ASCII character each.
 *
 * Not a good screen, but a correct one - and the only tier where a mark that
 * is merely decorative should be dropped rather than approximated, which is
 * why `file` is a dash and not an ambitious `#`.
 */
export const ASCII_ICONS: IconSet = {
  folder: '+',
  folderOpen: '-',
  file: '-',
  markdown: 'M',
  code: '#',
  data: '=',

  save: '=',
  revert: '<',
  undo: '[',
  redo: ']',
  close: 'x',
  edit: 'e',
  read: 'o',

  newFile: '+',
  newFolder: '+',
  rename: 'r',
  delete: 'd',
  extension: 'X',

  layout: '#',
  arrangement: '%',
  split: '|',
  theme: 'o',
  sidebar: '[',
  statusBar: '_',
  titleBar: '^',

  palette: '/',
  search: '/',
  go: '@',
  next: '>',
  previous: '<',
  keys: 'k',
  about: 'i',
  camera: 'c',

  activeRule: '|',
  dirty: '*',
  readonly: '!',
  error: 'x',
  warning: '!',
  ok: 'v',
};

/**
 * The icon set for a terminal.
 *
 * Takes the level rather than the app so a caller that already knows - a test,
 * a static render - does not have to invent an application to ask.
 */
export function iconsFor(unicode: UnicodeLevel): IconSet {
  if (unicode === 'ascii') return ASCII_ICONS;
  if (unicode === 'bmp') return BMP_ICONS;
  return FULL_ICONS;
}

/**
 * The full set, for a caller that is not drawing.
 *
 * Anything that ends up on screen should go through `iconsFor` instead, the
 * same way a component asks the theme rather than writing `'●'`.
 */
export const Icon = FULL_ICONS;

/** Every tier, for the test that measures them. */
export const ICON_SETS: Record<UnicodeLevel, IconSet> = {
  full: FULL_ICONS,
  bmp: BMP_ICONS,
  ascii: ASCII_ICONS,
};

/**
 * The icons that are safe to put in a fixed-width column.
 *
 * Exported so a test can check the whole set at once instead of finding out
 * when a row is one cell wider than its neighbours. Anything that measures
 * wider than a cell belongs in prose, not in a gutter.
 */
export const ICON_WIDTH_SAFE: readonly IconName[] = Object.keys(FULL_ICONS) as IconName[];
