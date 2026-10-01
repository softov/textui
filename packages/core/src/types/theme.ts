import type { Color } from './cells.js';
import type {
  BorderChars, BorderStyle, ColorToken, CursorStyle, Density, DividerChars, DividerStyle,
  Style, StyleColor, TableRules,
} from './style.js';
import type { SyntaxScope } from './syntax.js';
import type { Disposable } from './disposable.js';
import type { TerminalCapabilities } from './capabilities.js';

/** Spacing scale, in cells. Terminals have no sub-cell spacing. */
export interface ThemeSpacing {
  none: number;
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
}

/**
 * The glyph vocabulary. Separated from colour because a 16-colour terminal may
 * still be full-Unicode, and an ascii-only terminal may be truecolor.
 */
export interface ThemeGlyphs {
  /** Status dots, bullets, arrows - keyed by role so a component names a role. */
  bulletFilled: string;
  bulletHollow: string;
  bulletHalf: string;
  check: string;
  cross: string;
  warning: string;
  info: string;
  chevronRight: string;
  chevronDown: string;
  chevronLeft: string;
  chevronUp: string;
  arrowUp: string;
  arrowDown: string;
  arrowLeft: string;
  arrowRight: string;
  ellipsis: string;
  search: string;
  radioOn: string;
  radioOff: string;
  checkboxOn: string;
  checkboxOff: string;
  checkboxMixed: string;
  /** Eight levels for sparklines and bar charts. */
  blocks: readonly string[];
  /** Progress bar track and fill. */
  progressFull: string;
  progressEmpty: string;
  progressPartial: readonly string[];
  spinner: readonly string[];
  /** Text cursor when the terminal cursor is unavailable. */
  caret: string;
  separator: string;
  /** Path separator in a breadcrumb. */
  breadcrumb: string;
  /**
   * Where a region sits in the frame.
   *
   * One family, so a list of regions reads as a diagram rather than as six
   * unrelated marks: the glyph says *where*, and `regionOff` says the region
   * is not on screen. A tick cannot say where, which is why a list of ticks
   * needs a second column of words to be readable at all.
   */
  regionTop: string;
  regionBottom: string;
  regionLeft: string;
  regionRight: string;
  regionCentre: string;
  regionOff: string;
}

export interface ThemeDefinition {
  id: string;
  name: string;
  appearance: 'light' | 'dark';
  /**
   * Whether this theme has any colour to give.
   *
   * A theme's palette is its own business, but a component can state a literal
   * colour - an ink, a chart, a hand-picked hex - and that used to come through
   * untouched, so `mono` painted a rainbow the moment a banner asked for one.
   * Stated, every colour resolves to the terminal's own: tokens and literals
   * alike, which is what a theme that says it has no colour has to mean.
   */
  monochrome?: boolean;
  /** Extend another registered theme; only the differences need stating. */
  extends?: string;
  colors: Partial<Record<ColorToken, Color>>;
  spacing?: Partial<ThemeSpacing>;
  glyphs?: Partial<ThemeGlyphs>;
  /** Default border style for chrome. `'none'` gives the borderless look. */
  border?: BorderStyle;
  borderChars?: Partial<Record<BorderStyle, BorderChars>>;
  /**
   * Default rule style. Independent of `border`, so a borderless theme can
   * still separate with a line.
   */
  divider?: DividerStyle;
  dividerChars?: Partial<Record<DividerStyle, DividerChars>>;
  /** The caret's shape. The terminal's own setting is the default. */
  cursor?: CursorStyle;
  /**
   * How much of a table gets ruled.
   *
   * `header` is the default and the quiet one: a box, and a rule under the
   * header. `all` puts a rule between every pair of rows as well, which is
   * what a table of few, long rows wants - a wrapped-looking cell beside a
   * short one is ambiguous about which row it belongs to until something
   * separates them. On a table of twenty short rows the same lines are noise,
   * which is why it is the theme's call rather than the default.
   */
  tableRules?: TableRules;
  density?: Density;
  /**
   * Per-component style overrides, keyed by component name then variant or
   * state.
   *
   * A composite component has to name which of its boxes this is - a list row
   * is a `box` node, and `List` is what a theme author knows it by - so the
   * name is stated at the node with `styleAs` and the map is keyed by it.
   * `base` is the component at rest; the rest are the variants it supports and
   * the five states in `StateName`.
   */
  components?: Record<string, Record<string, Style>>;
  /**
   * Colours for syntax scopes. Every scope has a default drawn from the
   * semantic palette, so a theme states only what it wants to differ - and a
   * theme that states nothing still highlights.
   */
  syntax?: Partial<Record<SyntaxScope, StyleColor>>;
}

/** A theme after `extends` resolution and capability downgrade. */
export interface ResolvedTheme {
  id: string;
  name: string;
  appearance: 'light' | 'dark';
  /** Whether every colour this theme gives back is the terminal's own. */
  monochrome: boolean;
  colors: Record<ColorToken, Color>;
  spacing: ThemeSpacing;
  glyphs: ThemeGlyphs;
  border: BorderStyle;
  divider: DividerStyle;
  cursor: CursorStyle | undefined;
  tableRules: TableRules;
  density: Density;
  components: Record<string, Record<string, Style>>;
  /** Every syntax scope, resolved to a colour. */
  syntax: Record<SyntaxScope, Color>;
  /** Resolve a token (or pass a literal colour through, unless monochrome). */
  color(token: string): Color;
  borderChars(style?: BorderStyle): BorderChars;
  dividerChars(style?: DividerStyle): DividerChars;
  /**
   * Component style for a name and a list of names to merge over it, in the
   * order given - later names win.
   *
   * The names are the component's `variant`, `tone` and `size` followed by the
   * interaction states that are true: `selected`, `hover`, `active` (pressed),
   * `focus` and `disabled`. So `components.List.selected` is the fill on the
   * current row, and `components.List.focused` is the brighter one on the
   * current row while the list has the keyboard.
   *
   * The order is the same one `flattenStyleInput` merges a `style` prop in, so
   * a state stated at the node and the same state stated by the theme resolve
   * to one answer rather than to whichever happened to be asked second.
   */
  styleFor(component: string, variants?: string[]): Style;
}

export interface ThemeRegistry {
  register(def: ThemeDefinition): Disposable;
  unregister(id: string): void;
  get(id: string): ThemeDefinition | undefined;
  list(): ThemeDefinition[];
  /** Resolve `extends`, apply capability downgrade, return a usable theme. */
  resolve(id: string, caps: TerminalCapabilities): ResolvedTheme;
}
