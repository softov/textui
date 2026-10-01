import type { BoxProps } from '@textui/core';
import { defineComponent, h, useCapabilities, useMeasure, useTheme } from '@textui/core';
import { banner, DEFAULT_FONT, fontAt, inkGlyphs } from './fonts.js';
import type { Font } from './fonts.js';

/**
 * `wrap` is not `BoxProps.wrap`.
 *
 * On a `text` it means where a line of *characters* is cut, and the whole point
 * of this component is that the block it draws is not a line of characters: its
 * rows are the rows of the letters, so cutting one at column sixty cuts every
 * letter in it in half. `wrap` here means the one thing that can be done
 * instead - break the *text* between its words, measured in the font - and it
 * has no `char`, because a banner broken mid-word is not a banner. The drawn
 * rows are handed to the `text` node as `wrap: 'none'` always; a caller cannot
 * reach that.
 */
export interface FontTextProps extends Omit<BoxProps, 'wrap'> {
  /** The text to draw. A newline is a line, and each is a line of banner. */
  content: string;
  /**
   * The font to draw it in. The shipped `block` table by default.
   *
   * A font may name a substitute for a terminal that cannot draw its glyphs -
   * `fallback` - and that is used here in place of it. There is no guessing one
   * for a table the library has never seen, which is why the font says.
   */
  font?: Font;
  /**
   * Break the text between its words so the drawn banner fits the box.
   *
   * `'none'` - the default - draws the text as it was written, however wide
   * that is: a banner is usually a size somebody picked, and at a width the
   * caller did not intend, letters that reflow are worse than letters that
   * overflow. `'word'` asks the box for its width and breaks the text to it,
   * words first and a word too wide for a line of its own spent a character at
   * a time, which is the only place a letter boundary is ever crossed.
   *
   * It measures the box, so the first frame - which has no width yet - draws
   * one unbroken line, exactly as `'none'` would.
   */
  wrap?: 'none' | 'word';
  /**
   * Blank rows between one line of the block and the next. One by default.
   *
   * Not `gap`, which every box already has and means the space between its
   * *children*: this is the space between the rows of one drawing. `0` butts
   * the lines together, which for a font with a ground of its own - `pagga`'s
   * `░`, `tmplt`'s rules - merges them into one texture; a larger number is air
   * between them, and reads as two lines rather than as one.
   *
   * A newline in `content` is a line, and so is a wrap when `wrap: 'word'` is
   * breaking the text: the gap is the same one either way.
   */
  lineGap?: number;
}

/**
 * Text as block letters.
 *
 * The shape only: a string in, the same string drawn in the font's glyphs out,
 * as a `text` node that inherits its colour like any other. Colouring the
 * letters cell by cell - a ramp across a banner, a palette down it - is
 * [`ColorText`](color-text.md), and handing it this output is the pair the two
 * were split for.
 *
 * The letters are laid out by [`banner`](fonts.ts), which measures in the font
 * rather than in cells, so the tracking is the font's and a glyph is
 * proportional to what it actually draws. A character the font has no glyph for
 * becomes a word space, so a missing letter shows as a gap rather than quietly
 * closing up, and the placeholders a table is written in - `#`, `%`, `^`, `v` -
 * are filled from the theme's own glyphs, which is what keeps a banner legible
 * on a terminal that can only do ascii.
 */
export const FontText = defineComponent<FontTextProps>('FontText', (props) => {
  const theme = useTheme();
  const capabilities = useCapabilities();
  const measured = useMeasure();
  const { content, font: chosen, wrap, lineGap, ...rest } = props;

  const unicode = capabilities.unicode !== 'ascii';
  const picked = chosen ?? DEFAULT_FONT;
  const font = !unicode && picked.fallback ? fontAt(picked.fallback) : picked;
  const width = wrap === 'word' ? measured.width : undefined;
  const drawn = banner(
    content, font, inkGlyphs(theme.glyphs, unicode), width ?? Number.POSITIVE_INFINITY, lineGap,
  );

  // `wrap: 'none'` *after* the spread, so the lines `banner` decided on are the
  // lines drawn. Every one of them is a row of letters; a text node wrapping
  // one cuts letters in half, and a caller who passed a `TextWrap` through
  // `...rest` would be doing exactly that.
  return h('text', { content: drawn, ...rest, wrap: 'none' });
});
