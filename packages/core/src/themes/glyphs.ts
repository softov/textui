import type { ThemeGlyphs } from '../types/theme.js';
import type { UnicodeLevel } from '../types/capabilities.js';

/**
 * The glyph vocabulary, named by role.
 *
 * A component asks for `bulletFilled`, never for `'●'`, so the same catalog
 * renders on a full-Unicode terminal and on one that can only do ASCII - and
 * so a theme can restate the vocabulary without touching a component.
 */
export const FULL_GLYPHS: ThemeGlyphs = {
  bulletFilled: '●',
  bulletHollow: '○',
  bulletHalf: '◐',
  check: '✓',
  cross: '✕',
  warning: '⚠',
  info: 'ℹ',
  chevronRight: '▸',
  chevronDown: '▾',
  chevronLeft: '◂',
  chevronUp: '▴',
  arrowUp: '↑',
  arrowDown: '↓',
  ellipsis: '…',
  search: '⌕',
  radioOn: '◉',
  radioOff: '◯',
  checkboxOn: '☑',
  checkboxOff: '☐',
  checkboxMixed: '☒',
  blocks: ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'],
  progressFull: '█',
  progressEmpty: '░',
  progressPartial: ['▏', '▎', '▍', '▌', '▋', '▊', '▉'],
  spinner: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  caret: '▏',
  separator: '·',
  breadcrumb: '›',
  regionTop: '⬒',
  regionBottom: '⬓',
  regionLeft: '◧',
  regionRight: '◨',
  regionCentre: '▣',
  regionOff: '□',
};

/** Box-drawing and geometric shapes only - no braille, no dingbats. */
export const BMP_GLYPHS: ThemeGlyphs = {
  ...FULL_GLYPHS,
  check: '√',
  cross: 'x',
  info: 'i',
  spinner: ['|', '/', '-', '\\'],
  checkboxOn: '[x]',
  checkboxOff: '[ ]',
  checkboxMixed: '[-]',
};

export const ASCII_GLYPHS: ThemeGlyphs = {
  bulletFilled: '*',
  bulletHollow: 'o',
  bulletHalf: '+',
  check: 'v',
  cross: 'x',
  warning: '!',
  info: 'i',
  chevronRight: '>',
  chevronDown: 'v',
  chevronLeft: '<',
  chevronUp: '^',
  arrowUp: '^',
  arrowDown: 'v',
  ellipsis: '...',
  search: '/',
  radioOn: '(*)',
  radioOff: '( )',
  checkboxOn: '[x]',
  checkboxOff: '[ ]',
  checkboxMixed: '[-]',
  blocks: ['_', '.', ',', '-', '=', '+', '*', '#'],
  progressFull: '#',
  progressEmpty: '-',
  progressPartial: ['-'],
  spinner: ['|', '/', '-', '\\'],
  caret: '_',
  separator: '-',
  breadcrumb: '>',
  regionTop: '^',
  regionBottom: 'v',
  regionLeft: '[',
  regionRight: ']',
  regionCentre: '+',
  regionOff: '.',
};

export function glyphsFor(unicode: UnicodeLevel): ThemeGlyphs {
  if (unicode === 'ascii') return ASCII_GLYPHS;
  if (unicode === 'bmp') return BMP_GLYPHS;
  return FULL_GLYPHS;
}
