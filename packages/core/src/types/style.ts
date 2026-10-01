import type { Color } from './cells.js';
import type { EdgeSpec } from './geometry.js';

/**
 * Semantic theme tokens, split by the channel each one is written in.
 *
 * A component names a role, never a colour - which is what lets one catalog
 * render the same under a light theme, a dark theme and a 16-colour ssh
 * session. The role is not enough on its own, though: a token also has to be
 * somewhere it can actually be drawn. `canvas` is a fill, `onAccent` is
 * writing, `borderStrong` is a rule - and one union for all three is what let
 * `fg: 'canvas'` and `border: 'onAccent'` compile, to be found by somebody
 * looking at a frame.
 *
 * So each token is listed under the channels it may appear in, and `Style`
 * takes the matching one. A token may appear in more than one - the tones are
 * both a fill and a colour of their own - and a literal colour is the shared
 * escape out of all three.
 *
 * A token missing from a list is a token that channel cannot use. Adding one
 * is a decision about where it reads, not a convenience.
 */

/** Colours a cell's foreground may be. */
export type FgColorToken =
  // A tone is a colour in its own right as well as a fill it provides.
  | 'accent' | 'primary' | 'secondary'
  | 'success' | 'warning' | 'danger' | 'info'
  // The states are readable as text too: a disabled label, a focus-coloured
  // border rendered as a caption.
  | 'hover' | 'active' | 'selected' | 'focus' | 'disabled'
  | 'text' | 'muted' | 'subtle' | 'inverted'
  // A quiet rule is also the quietest text there is.
  | 'borderSubtle'
  // The caret is the one token that is honestly both: an underline caret is
  // drawn in the foreground, and a block caret is the foreground swapped, so
  // both halves are reached by naming it here.
  | 'cursor'
  | 'onDefault' | 'onMuted'
  | 'onAccent' | 'onPrimary' | 'onSecondary'
  | 'onSuccess' | 'onWarning' | 'onDanger' | 'onInfo'
  | 'onSelected' | 'onActive';

/** Colours a cell's background may be. */
export type BgColorToken =
  | 'canvas' | 'surface' | 'surfaceAlt' | 'overlay'
  | 'hover' | 'active' | 'selected' | 'focus' | 'disabled'
  | 'accent' | 'primary' | 'secondary'
  | 'success' | 'warning' | 'danger' | 'info'
  // What is over everything, what the caret is, and what a shadow is.
  | 'scrim' | 'cursor' | 'shadow';

/** Colours a rule may be. */
export type BorderColorToken =
  | 'border' | 'borderStrong' | 'borderSubtle' | 'divider'
  | 'accent' | 'primary' | 'secondary'
  | 'success' | 'warning' | 'danger' | 'info'
  | 'hover' | 'focus'
  // A quiet rule and a quiet label are the same two colours often enough that
  // a frame drawn in `muted` is a line somebody means, not a mistake. What is
  // refused here is the loud end of the foreground list: a rule in `text` or
  // in an `on*` token is writing used as structure.
  | 'muted' | 'subtle';

/** Every token, for the places that take a colour without saying which. */
export type ColorToken = FgColorToken | BgColorToken | BorderColorToken;

/** A foreground: an `FgColorToken`, or a literal colour. */
export type FgColor = FgColorToken | Color;
/** A background: a `BgColorToken`, or a literal colour. */
export type BgColor = BgColorToken | Color;
/** A rule: a `BorderColorToken`, or a literal colour. */
export type BorderColor = BorderColorToken | Color;

/** Anywhere a colour is accepted, any token and any literal are accepted too. */
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

/**
 * A rule that separates, rather than a frame that encloses.
 *
 * Kept apart from `BorderStyle` on purpose: a theme that draws no frames may
 * still want a rule, and tying the two means choosing a divider glyph decides
 * whether every bordered component reserves a ring.
 */
export type DividerStyle =
  | 'none' | 'single' | 'double' | 'dashed' | 'thick' | 'ascii';

/** A divider runs either way, so it names both. */
export interface DividerChars {
  horizontal: string;
  vertical: string;
}

/**
 * The shape of the caret.
 *
 * Named for DECSCUSR, which is what a terminal understands, so a theme value
 * maps straight onto the escape sequence with nothing to translate.
 */
export type CursorStyle = 'block' | 'underline' | 'bar';

/**
 * How much of a table gets ruled: the header only, or between every row.
 *
 * Not a border style - it is a question about how many lines, not which
 * glyphs. The glyphs are the theme's border set either way.
 */
export type TableRules = 'header' | 'all';

export type BorderSides = {
  top?: boolean;
  right?: boolean;
  bottom?: boolean;
  left?: boolean;
};

/** A colour per edge. Unnamed edges fall back to the border's `color`. */
export type BorderColors = {
  top?: BorderColor;
  right?: BorderColor;
  bottom?: BorderColor;
  left?: BorderColor;
};

export type BorderSpec =
  | BorderStyle
  | {
      style?: BorderStyle;
      color?: BorderColor;
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
  scrim?: boolean | BgColor;
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
  fg?: FgColor;
  bg?: BgColor;
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

/**
 * Styles selected by interaction state. Merged over the base in this order.
 *
 * `selected` is "this is the current one"; `focus` is "and the keyboard is
 * here", so a row that has both wears `focus` and a row that has only the
 * first wears the dimmer `selected`. They are separate names because they
 * were the same word once - `active` meant both the unfocused selection here
 * and the pressed state in `InteractionState` - and a token that meant two
 * things could be filled with either and looked wrong half the time.
 */
export interface StatefulStyle {
  base?: Style;
  focus?: Style;
  hover?: Style;
  /** Pressed. Never a selection. */
  active?: Style;
  selected?: Style;
  disabled?: Style;
}

/** The states, in the order the last one wins. The shared vocabulary. */
export type StateName = 'selected' | 'hover' | 'active' | 'focus' | 'disabled';

export type StyleInput = Style | StatefulStyle | (Style | StatefulStyle | undefined | false)[];

/** Global semantic variants, available to every component that opts in. */
export type SemanticVariant =
  | 'default' | 'primary' | 'secondary' | 'accent'
  | 'success' | 'warning' | 'danger' | 'info' | 'muted';

/** Presentational variants a component may support. */
export type SurfaceVariant = 'solid' | 'outline' | 'ghost' | 'link';

export type Density = 'compact' | 'normal' | 'airy';
