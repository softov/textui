import type { Color } from './cells.js';
import type { EdgeSpec } from './geometry.js';

/**
 * Semantic theme tokens. A component names a role, never a colour - which is
 * what lets one catalog render the same under a light theme, a dark theme and
 * a 16-colour ssh session.
 */
export type ColorToken =
  | 'canvas' | 'surface' | 'surfaceAlt' | 'overlay'
  | 'border' | 'borderStrong' | 'borderSubtle'
  | 'text' | 'muted' | 'subtle' | 'inverted'
  | 'accent' | 'primary' | 'secondary'
  | 'success' | 'warning' | 'danger' | 'info'
  | 'onAccent' | 'onPrimary' | 'onSuccess' | 'onWarning' | 'onDanger' | 'onInfo'
  | 'hover' | 'active' | 'selected' | 'focus' | 'disabled'
  | 'scrim' | 'cursor' | 'shadow';

/** Anywhere a colour is accepted, a semantic token is accepted too. */
export type StyleColor = ColorToken | Color;

export type Dimension = number | `${number}%` | 'auto';

export type BorderStyle =
  | 'none' | 'single' | 'double' | 'round' | 'bold'
  | 'dashed' | 'ascii' | 'thick' | 'half';

/** The twelve glyphs a box needs. Themes may ship their own set. */
export interface BorderChars {
  topLeft: string;
  top: string;
  topRight: string;
  right: string;
  bottomRight: string;
  bottom: string;
  bottomLeft: string;
  left: string;
  /** junctions, for tables and split panels */
  cross: string;
  teeTop: string;
  teeBottom: string;
  teeLeft: string;
  teeRight: string;
}

export type BorderSides = {
  top?: boolean;
  right?: boolean;
  bottom?: boolean;
  left?: boolean;
};

export type BorderSpec =
  | BorderStyle
  | {
      style?: BorderStyle;
      color?: StyleColor;
      sides?: BorderSides;
      chars?: Partial<BorderChars>;
    };

export type Align = 'start' | 'center' | 'end' | 'stretch' | 'baseline';
export type Justify = 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
export type Overflow = 'visible' | 'hidden' | 'scroll' | 'ellipsis';
export type Position = 'relative' | 'absolute';
export type TextWrap = 'none' | 'word' | 'char';

export interface Style {
  /**
   * Wash whatever is already painted here toward this colour, instead of
   * drawing over it. A modal scrim in a terminal: the screen behind recedes
   * but stays legible, rather than being replaced by a rectangle of nothing.
   * `true` uses the theme's `scrim` token; a number sets the strength.
   */
  scrim?: boolean | StyleColor;
  scrimStrength?: number;

  // --- box ---
  display?: 'flex' | 'none';
  direction?: 'row' | 'column';
  gap?: number;
  padding?: EdgeSpec;
  margin?: EdgeSpec;
  width?: Dimension;
  height?: Dimension;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  /** Grow factor along the parent's main axis. 0 = size to content. */
  flex?: number;
  /** Shrink factor. Defaults to 1 when flex is unset. */
  shrink?: number;
  /** Base size along the main axis before grow/shrink. */
  basis?: Dimension;
  align?: Align;
  alignSelf?: Align;
  justify?: Justify;
  position?: Position;
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
  /** Painting and hit-testing order within a layer. */
  zIndex?: number;
  overflow?: Overflow;

  // --- paint ---
  fg?: StyleColor;
  bg?: StyleColor;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
  inverse?: boolean;
  strike?: boolean;
  blink?: boolean;
  border?: BorderSpec;

  // --- text ---
  wrap?: TextWrap;
  textAlign?: 'left' | 'center' | 'right';
  /** Character painted into empty cells of this box. */
  fill?: string;
}

/** Styles selected by interaction state. Merged over the base in this order. */
export interface StatefulStyle {
  base?: Style;
  focus?: Style;
  hover?: Style;
  active?: Style;
  selected?: Style;
  disabled?: Style;
}

export type StyleInput = Style | StatefulStyle | (Style | StatefulStyle | undefined | false)[];

/** Global semantic variants, available to every component that opts in. */
export type SemanticVariant =
  | 'default' | 'primary' | 'secondary' | 'accent'
  | 'success' | 'warning' | 'danger' | 'info' | 'muted';

/** Presentational variants a component may support. */
export type SurfaceVariant = 'solid' | 'outline' | 'ghost' | 'soft' | 'link';

export type Density = 'compact' | 'normal' | 'airy';
