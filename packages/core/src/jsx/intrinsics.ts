import type { Style, StyleInput } from '../types/style.js';
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
  onMouse?(event: MouseEvent): boolean | void;
  onClick?: Action | ((event: MouseEvent) => void);
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
  /** Cells to take. Unset means "take whatever is left". */
  size?: number;
}
