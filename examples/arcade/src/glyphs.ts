import type { UnicodeLevel } from '@textui/core';

/**
 * The vocabulary a game draws with.
 *
 * The same rule the themes follow, for the same reason: nothing here asks for
 * `'█'`, it asks for `solid`, so an ascii terminal gets a game rather than a
 * field of question marks. It is the arcade's own vocabulary rather than the
 * theme's because a theme has no opinion about what a snake is made of - and a
 * game that borrowed `progressFull` for its bricks would be restyled out from
 * under itself the day a theme restyled progress bars.
 *
 * Every mark is two columns wide, because a cell is two columns wide - that is
 * what makes a square field look square instead of half as tall as it is wide.
 * The marks differ in *shape* and not only in colour, so a snake's head is
 * still its head on a sixteen-colour terminal.
 */
export interface GameGlyphs {
  solid: string;
  soft: string;
  food: string;
  wall: string;
  /** One column, half a row. Where the ball lives. */
  dotFull: string;
  dotTop: string;
  dotBottom: string;
}

/** Blocks and geometric shapes - all of it BMP, none of it a dingbat. */
const BLOCKS: GameGlyphs = {
  solid: '██',
  soft: '▒▒',
  food: '◆◆',
  wall: '▓▓',
  dotFull: '█',
  dotTop: '▀',
  dotBottom: '▄',
};

/**
 * ASCII loses the half-row, and that is the honest outcome: a terminal with
 * one glyph per cell cannot draw half of one, so the ball is drawn in whole
 * rows there rather than at a position it is not actually at.
 */
const ASCII: GameGlyphs = {
  solid: '##',
  soft: '::',
  food: '**',
  wall: '||',
  dotFull: '#',
  dotTop: '#',
  dotBottom: '#',
};

export function glyphsFor(unicode: UnicodeLevel): GameGlyphs {
  return unicode === 'ascii' ? ASCII : BLOCKS;
}
