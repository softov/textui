import type { Color } from './cells.js';
import type { BorderChars, BorderStyle, ColorToken, CursorStyle, Density, DividerChars, DividerStyle, Style, StyleColor } from './style.js';
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
  density?: Density;
  /** Per-component style overrides, keyed by component name then variant. */
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
  colors: Record<ColorToken, Color>;
  spacing: ThemeSpacing;
  glyphs: ThemeGlyphs;
  border: BorderStyle;
  divider: DividerStyle;
  cursor: CursorStyle | undefined;
  density: Density;
  components: Record<string, Record<string, Style>>;
  /** Every syntax scope, resolved to a colour. */
  syntax: Record<SyntaxScope, Color>;
  /** Resolve a token (or pass a literal colour through). */
  color(token: string): Color;
  borderChars(style?: BorderStyle): BorderChars;
  dividerChars(style?: DividerStyle): DividerChars;
  /** Component style for a name + variant list, merged in order. */
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
