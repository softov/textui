import type { DividerChars, DividerStyle } from '../types/style.js';

/**
 * The divider sets.
 *
 * A parallel to `BORDER_SETS`, and deliberately not part of it. A border is
 * thirteen characters that only mean anything together - they enclose a box.
 * A divider encloses nothing: it is one rule, in one direction, whose whole
 * job is to separate. Folding it into `BorderChars` made a theme choose a
 * frame style in order to choose a rule, so a borderless theme could not have
 * one without every bordered component reserving a ring it never draws.
 */
export const DIVIDER_SETS: Record<DividerStyle, DividerChars> = {
  none: { horizontal: ' ', vertical: ' ' },
  single: { horizontal: '┈', vertical: '│' },
  double: { horizontal: '═', vertical: '║' },
  dashed: { horizontal: '┄', vertical: '┆' },
  thick: { horizontal: '━', vertical: '┃' },
  ascii: { horizontal: '-', vertical: '|' },
};

/** What a terminal with no box drawing gets instead. */
const ASCII_FALLBACK: Record<DividerStyle, DividerStyle> = {
  none: 'none',
  single: 'ascii',
  double: 'ascii',
  dashed: 'ascii',
  thick: 'ascii',
  ascii: 'ascii',
};

/**
 * The BMP tier has box drawing but not every weight of it: `┄` and `━` are
 * outside it, and a missing glyph is a question mark on somebody's terminal.
 */
const BMP_FALLBACK: Partial<Record<DividerStyle, DividerStyle>> = {
  dashed: 'single',
  thick: 'single',
};

export function dividerCharsFor(
  style: DividerStyle,
  unicode: 'ascii' | 'bmp' | 'full',
): DividerChars {
  if (unicode === 'ascii') return DIVIDER_SETS[ASCII_FALLBACK[style]];
  if (unicode === 'bmp') return DIVIDER_SETS[BMP_FALLBACK[style] ?? style];
  return DIVIDER_SETS[style];
}
