import type { StyleColor } from './style.js';

/**
 * Markdown, as rows a terminal can scroll.
 *
 * Two shapes and one invariant: **every row is exactly one row tall.** That is
 * what makes "how far can this scroll" a length rather than an estimate - one
 * source line becomes three rows when it wraps and none when it is a fence
 * marker, so counting source lines is counting the wrong unit and the tail of
 * a long document becomes unreachable.
 *
 * A fence is the exception that proves it: it is several rows, so it becomes
 * several rows here, each tagged with the fence it belongs to so a painter can
 * put the visible ones back into one box.
 */

/** A run of text with one style. Inline emphasis is why rows are not strings. */
export interface MarkdownRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  /** An OSC 8 target, where the terminal has hyperlinks. */
  link?: string;
}

export type MarkdownRow =
  | { kind: 'rule' }
  | { kind: 'heading'; runs: MarkdownRun[]; level: number }
  | { kind: 'text'; runs: MarkdownRun[]; prefix?: string; prefixFg?: StyleColor; fg?: StyleColor }
  | { kind: 'fence'; fence: number; part: 'open' | 'code' | 'close'; text?: string; language?: string };

export interface MarkdownLayoutOptions {
  /** Cells to wrap to. Zero means "not measured yet" - nothing is wrapped. */
  width: number;
  /** The bullet glyph. Passed in, because glyphs come from the theme. */
  bullet?: string;
  /** The rule down the left of a block quote. Also a theme glyph. */
  quoteBar?: string;
  /**
   * Whether a fence gets an opening and closing rule row.
   *
   * A borderless theme draws neither, and a layout that reserved two rows for
   * rules nobody draws stops two rows short of the end of the document.
   */
  ruled?: boolean;
}
