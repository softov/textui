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
  | 'onDefault' | 'onMuted'
  | 'onAccent' | 'onPrimary' | 'onSecondary'
  | 'onSuccess' | 'onWarning' | 'onDanger' | 'onInfo'
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

/** A colour per edge. Unnamed edges fall back to the border's `color`. */
export type BorderColors = {
  top?: StyleColor;
  right?: StyleColor;
  bottom?: StyleColor;
  left?: StyleColor;
};

export type BorderSpec =
  | BorderStyle
  | {
      style?: BorderStyle;
      color?: StyleColor;
      /**
       * Per-edge colour, over `color`. A corner belongs to the edge that runs
       * through it - the top rule owns both top corners - because a cell holds
       * one colour and a terminal has no mitre to split it along.
       */
      colors?: BorderColors;
      sides?: BorderSides;
      chars?: Partial<BorderChars>;
      /**
       * Draw the frame dim. The frame only: a dim attribute on the box itself
       * would take the content with it, and a quiet border around ordinary
       * text is the whole reason to ask.
       */
      dim?: boolean;
    };

export type Align = 'start' | 'center' | 'end' | 'stretch' | 'baseline';
export type Justify = 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
export type Overflow = 'visible' | 'hidden' | 'scroll' | 'ellipsis';
export type Position = 'relative' | 'absolute';
export type FlexWrap = 'nowrap' | 'wrap';
/**
 * How a run of text meets the edge of its box.
 *
 * `none`, `word` and `char` describe *wrapping*: the text keeps every
 * character and takes as many rows as it needs. The `truncate-*` forms are the
 * opposite bargain - one row, and whatever does not fit is replaced by an
 * ellipsis at the named end. `truncate` is `truncate-end`, which is the one
 * everybody means.
 *
 * A truncating text is one row tall by definition, so an embedded newline
 * would have nowhere to go; those become spaces rather than being dropped,
 * because a joined sentence still reads and a silently halved one does not.
 */
export type TextWrap =
  | 'none' | 'word' | 'char'
  | 'truncate' | 'truncate-start' | 'truncate-middle' | 'truncate-end';


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
  /** Space between children on both axes. `columnGap`/`rowGap` override it. */
  gap?: number;
  /**
   * Space between columns - horizontal, whichever way the container runs. It
   * is the gap *between* children on a row, and the gap between wrapped lines
   * on a column.
   */
  columnGap?: number;
  /** Space between rows - vertical. The mirror of `columnGap`. */
  rowGap?: number;
  /**
   * Whether children that do not fit start a new line. `nowrap` is the
   * default and the cheaper path: one line, children shrink or get clipped.
   */
  flexWrap?: FlexWrap;
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
  /** What happens to content past the edge, on both axes. */
  overflow?: Overflow;
  /** Overrides `overflow` sideways. A row that scrolls but does not grow. */
  overflowX?: Overflow;
  /** Overrides `overflow` downwards. The usual scroll container. */
  overflowY?: Overflow;

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
export type SurfaceVariant = 'solid' | 'outline' | 'ghost' | 'link';

export type Density = 'compact' | 'normal' | 'airy';
