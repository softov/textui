import type { BorderChars, BorderStyle } from '../types/style.js';

/**
 * Border glyph sets.
 *
 * `ascii` is not a fallback nobody sees - it is what an `unicode: 'ascii'`
 * terminal actually gets, so it has to look deliberate rather than broken.
 */
export const BORDER_SETS: Record<BorderStyle, BorderChars> = {
  none: {
    topLeft: ' ', top: ' ', topRight: ' ',
    right: ' ', bottomRight: ' ', bottom: ' ',
    bottomLeft: ' ', left: ' ',
    cross: ' ', teeTop: ' ', teeBottom: ' ', teeLeft: ' ', teeRight: ' ',
  },
  single: {
    topLeft: '┌', top: '─', topRight: '┐',
    right: '│', bottomRight: '┘', bottom: '─',
    bottomLeft: '└', left: '│',
    cross: '┼', teeTop: '┬', teeBottom: '┴', teeLeft: '┤', teeRight: '├',
  },
  round: {
    topLeft: '╭', top: '─', topRight: '╮',
    right: '│', bottomRight: '╯', bottom: '─',
    bottomLeft: '╰', left: '│',
    cross: '┼', teeTop: '┬', teeBottom: '┴', teeLeft: '┤', teeRight: '├',
  },
  double: {
    topLeft: '╔', top: '═', topRight: '╗',
    right: '║', bottomRight: '╝', bottom: '═',
    bottomLeft: '╚', left: '║',
    cross: '╬', teeTop: '╦', teeBottom: '╩', teeLeft: '╣', teeRight: '╠',
  },
  bold: {
    topLeft: '┏', top: '━', topRight: '┓',
    right: '┃', bottomRight: '┛', bottom: '━',
    bottomLeft: '┗', left: '┃',
    cross: '╋', teeTop: '┳', teeBottom: '┻', teeLeft: '┫', teeRight: '┣',
  },
  thick: {
    topLeft: '▛', top: '▀', topRight: '▜',
    right: '▐', bottomRight: '▟', bottom: '▄',
    bottomLeft: '▙', left: '▌',
    cross: '┼', teeTop: '┬', teeBottom: '┴', teeLeft: '┤', teeRight: '├',
  },
  half: {
    topLeft: '▗', top: '▄', topRight: '▖',
    right: '▌', bottomRight: '▘', bottom: '▀',
    bottomLeft: '▝', left: '▐',
    cross: '┼', teeTop: '┬', teeBottom: '┴', teeLeft: '┤', teeRight: '├',
  },
  dashed: {
    topLeft: '┌', top: '╌', topRight: '┐',
    right: '╎', bottomRight: '┘', bottom: '╌',
    bottomLeft: '└', left: '╎',
    cross: '┼', teeTop: '┬', teeBottom: '┴', teeLeft: '┤', teeRight: '├',
  },
  ascii: {
    topLeft: '+', top: '-', topRight: '+',
    right: '|', bottomRight: '+', bottom: '-',
    bottomLeft: '+', left: '|',
    cross: '+', teeTop: '+', teeBottom: '+', teeLeft: '+', teeRight: '+',
  },
};

/** What each style degrades to when the terminal cannot draw it. */
const ASCII_FALLBACK: Record<BorderStyle, BorderStyle> = {
  none: 'none',
  single: 'ascii',
  round: 'ascii',
  double: 'ascii',
  bold: 'ascii',
  thick: 'ascii',
  half: 'ascii',
  dashed: 'ascii',
  ascii: 'ascii',
};

/** Block-drawing styles need more than the BMP box-drawing range. */
const BMP_FALLBACK: Partial<Record<BorderStyle, BorderStyle>> = {
  thick: 'single',
  half: 'single',
};

export function borderCharsFor(
  style: BorderStyle,
  unicode: 'ascii' | 'bmp' | 'full',
): BorderChars {
  if (unicode === 'ascii') return BORDER_SETS[ASCII_FALLBACK[style]] as BorderChars;
  if (unicode === 'bmp') {
    const fallback = BMP_FALLBACK[style];
    return BORDER_SETS[fallback ?? style] as BorderChars;
  }
  return BORDER_SETS[style] as BorderChars;
}
