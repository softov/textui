import type { StyleColor, TableRules } from './style.js';

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

/** Which edge a table column's text is pushed against. */
export type MarkdownAlign = 'left' | 'center' | 'right';

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
  | { kind: 'fence'; fence: number; part: 'open' | 'code' | 'close'; text?: string; language?: string }
  /**
   * One line of a table, with its cells already fitted to their columns.
   *
   * The widths are decided once for the whole table and repeated on every row
   * of it, because a column that is measured per row is not a column. Cells
   * arrive padded and truncated to exactly `widths[i]`, so a painter only has
   * to put the separators in - which is also what keeps the one-row-per-row
   * invariant: a cell too long for its column is cut, never wrapped, or the
   * table would be a different height than the document said it was.
   *
   * `top`, `rule` and `bottom` are edges and carry no cells; the painter draws
   * them from the widths, in whatever the theme's border characters are. They
   * are rows here for the same reason a fence's rules are: they take a line on
   * the screen, so anything counting rows has to be able to count them.
   */
  | {
    kind: 'table';
    table: number;
    part: 'top' | 'head' | 'rule' | 'body' | 'bottom';
    cells: MarkdownRun[][];
    widths: number[];
    align: MarkdownAlign[];
  };

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
  /**
   * How much of a table gets ruled. The theme's `tableRules`, passed through.
   *
   * It has to be decided here rather than by whatever paints the rows,
   * because a rule between two rows *is* a row - it takes a line on the
   * screen. A painter that added them would be drawing more lines than the
   * layout counted, and every viewer that scrolls by row index would land in
   * the wrong place by one per table row.
   */
  tableRules?: TableRules;
}
