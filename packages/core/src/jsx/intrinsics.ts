import type { Style, StyleColor, StyleInput } from '../types/style.js';
import type { SemanticRole } from '../types/component-registry.js';
import type { KeyEvent, MouseEvent } from '../types/input.js';
import type { PaintSurface, RenderContext } from '../types/render.js';
import type { Action } from '../types/graph.js';

/**
 * Props every node accepts.
 *
 * Style arrives three ways on purpose: the full `style` object for anything
 * stateful, a merged list for composition, and the individual style keys
 * inline as convenience props - `<box gap={1} border="single">` rather than
 * `<box style={{ gap: 1, border: 'single' }}>` for the common case.
 */
export interface BaseProps extends Style {
  id?: string;
  key?: string | number;
  style?: StyleInput;

  /** Semantic metadata. Drives the test harness, and future a11y work. */
  role?: SemanticRole;
  label?: string;
  description?: string;
  disabled?: boolean;
  selected?: boolean;

  /**
   * The states this node is in, for `style` overlays and for a theme.
   *
   * `focused` is a tri-state on purpose. Left out, the runtime asks the focus
   * manager - which is right for a control and wrong for a row: a list row does
   * not hold the keyboard, the list does. A row that has to be told so, or the
   * distinction between "this is the current row" and "this is the current row
   * and you can type at it" cannot be drawn at all.
   */
  focused?: boolean;

  /**
   * Which of the component's boxes a theme styles.
   *
   * A composite component draws plain `box` nodes, so without this its entry
   * in a theme's `components` map is a key nothing reads - a list row is a
   * `box`, and `components.List.selected` is what a theme author would reach
   * for. The name has to be stated by the component that owns the box, which
   * is the only place that knows what the row is part of.
   *
   * Omitted, the node is styled under its own host name, so `components.box`
   * and a `variant` keep working exactly as they did.
   */
  styleAs?: string;

  /** Participates in tab order. Implied by an interactive role. */
  focusable?: boolean;
  /** The focus scope this node belongs to. */
  focusScope?: string;
  autoFocus?: boolean;
  /**
   * `onKey` runs whether or not this node is focused.
   *
   * For a node that wraps something else and wants the keys that thing
   * declines - a dropdown panel taking left and right while the menu inside it
   * keeps up and down. Without this a handler only runs while focused, which
   * is what focus means.
   */
  global?: boolean;

  onKey?(event: KeyEvent): boolean | void;
  onFocus?(): void;
  onBlur?(): void;
  /**
   * Every mouse action on this node, innermost first.
   *
   * Returning `true` stops it going any further - and on a `down`, **claims
   * the rest of the gesture**: the `drag`s and the `up` that follow come here
   * whatever they are over, until the button comes back up. Dispatch is
   * otherwise a hit test, so without that a drag would stop at the edge of the
   * node it started in, which is where a drag starts being worth having.
   */
  onMouse?(event: MouseEvent): boolean | void;
  /** The left button going down - a third of a gesture. `onMouse` for the rest. */
  onClick?: Action | ((event: MouseEvent) => void);
  /**
   * The pointer entered or left this node. Called once each way, not per cell.
   *
   * Hover is inherited the way it is in a browser: a row is hovered while the
   * pointer is over the label inside it, because the label is what a hit test
   * finds. A `style` with a `hover` overlay needs nothing else - this is for
   * the cases where something other than a colour has to happen.
   */
  onHover?(hovering: boolean): void;

  /** OSC 8 link target, where the terminal supports hyperlinks. */
  link?: string;

  /** Below this width the node renders `compact`; below that, `minimal`. */
  breakpoints?: { compact?: number; minimal?: number };
}

export interface BoxProps extends BaseProps {
  children?: unknown;
  /** Header text drawn into the top border. Needs a border to land on. */
  title?: string;
  titleAlign?: 'left' | 'center' | 'right';
  /**
   * A second label on the top border, hard against the right.
   *
   * For the short thing that belongs beside a heading rather than under it - a
   * count, a shortcut, a state. It takes its space first and `title` gets what
   * is left, so the two never collide and the title is the one that truncates.
   */
  rightTitle?: string;
  /** Footer text drawn into the bottom border. */
  footer?: string;
  footerAlign?: 'left' | 'center' | 'right';
  /** Scroll offset in cells, when overflow is 'scroll'. */
  scrollTop?: number;
  scrollLeft?: number;
}

export interface TextProps extends BaseProps {
  children?: unknown;
  /** The string to draw. `children` is accepted as a shorthand. */
  content?: string;
  /** Where to cut when the text does not fit. */
  truncate?: 'end' | 'start' | 'middle' | false;
  ellipsis?: string;
  /**
   * Text to pick out wherever it appears, case-insensitively.
   *
   * For search: the caller passes what it is looking for and the rows are
   * coloured where they hold it. It is applied after wrapping and truncation,
   * to the text as drawn - so nothing about how a paragraph is broken into
   * lines has to change to mark a hit in it, and a match split across a wrap
   * is simply not on either row to colour.
   */
  match?: string;
  /** The match's colours. Accent on its own foreground by default. */
  matchFg?: StyleColor;
  matchBg?: StyleColor;
}

export interface CanvasProps extends BaseProps {
  /**
   * Paint directly. The escape hatch charts and gauges use; everything else
   * should compose `box` and `text` so the layout engine can reason about it.
   */
  draw(surface: PaintSurface, ctx: RenderContext): void;
  /** Intrinsic size when the style does not fix one. */
  intrinsic?: { width?: number; height?: number };
}

export interface SpacerProps extends BaseProps {
  /** Cells to take. Unset means "take whatever is left", the same as `flex: 1`. */
  size?: number;
}
