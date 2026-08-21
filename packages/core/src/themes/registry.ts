import type {
  ResolvedTheme, ThemeDefinition, ThemeGlyphs, ThemeRegistry, ThemeSpacing,
} from '../types/theme.js';
import type { Color } from '../types/cells.js';
import type { BorderChars, BorderStyle, ColorToken, Density, StyleColor } from '../types/style.js';
import type { Style } from '../types/style.js';
import type { SyntaxScope } from '../types/syntax.js';
import type { TerminalCapabilities } from '../types/capabilities.js';
import type { Disposable } from '../types/disposable.js';
import { toDisposable } from '../util/disposable.js';
import { borderCharsFor } from './borders.js';
import { glyphsFor } from './glyphs.js';
import { BUILTIN_THEMES } from './builtin.js';

const DEFAULT_SPACING: ThemeSpacing = { none: 0, xs: 0, sm: 1, md: 1, lg: 2, xl: 3 };

const FALLBACK_COLORS: Record<ColorToken, Color> = {
  canvas: 'default', surface: 'default', surfaceAlt: 'default', overlay: 'default',
  border: 'default', borderStrong: 'default', borderSubtle: 'default',
  text: 'default', muted: 'default', subtle: 'default', inverted: 'default',
  accent: 'default', primary: 'default', secondary: 'default',
  success: 'green', warning: 'yellow', danger: 'red', info: 'cyan',
  onAccent: 'default', onPrimary: 'default', onSuccess: 'default',
  onWarning: 'default', onDanger: 'default', onInfo: 'default',
  hover: 'default', active: 'default', selected: 'default', focus: 'default',
  disabled: 'default', scrim: 'default', cursor: 'default', shadow: 'default',
};

/**
 * What each syntax scope means in semantic terms.
 *
 * Naming a token rather than a colour is what makes highlighting survive a
 * theme swap: `paper` gets ink-on-white strings and `console` gets green ones
 * from the same highlighter, and a theme with no palette at all - or a
 * terminal with no colour - resolves the lot to the default foreground.
 */
const SYNTAX_DEFAULTS: Record<SyntaxScope, ColorToken> = {
  plain: 'text',
  keyword: 'primary',
  string: 'success',
  number: 'info',
  boolean: 'warning',
  null: 'muted',
  comment: 'subtle',
  punctuation: 'muted',
  key: 'accent',
  operator: 'text',
  type: 'secondary',
  function: 'accent',
  tag: 'primary',
  attribute: 'accent',
  regexp: 'warning',
  escape: 'warning',
  invalid: 'danger',
};

/** Tokens that are the accent rather than merely near it. */
const FOLLOWS_ACCENT = ['focus', 'cursor'] as const;

export class Themes implements ThemeRegistry {
  private defs = new Map<string, ThemeDefinition>();
  private cache = new Map<string, ResolvedTheme>();

  constructor(initial: ThemeDefinition[] = BUILTIN_THEMES) {
    for (const def of initial) this.defs.set(def.id, def);
  }

  register(def: ThemeDefinition): Disposable {
    this.defs.set(def.id, def);
    this.cache.clear();
    return toDisposable(() => {
      this.defs.delete(def.id);
      this.cache.clear();
    });
  }

  unregister(id: string): void {
    this.defs.delete(id);
    this.cache.clear();
  }

  get(id: string): ThemeDefinition | undefined {
    return this.defs.get(id);
  }

  list(): ThemeDefinition[] {
    return [...this.defs.values()];
  }

  /**
   * Flatten the `extends` chain, then degrade glyphs and borders to what the
   * terminal can draw. Colour is *not* reduced here - the writer does that per
   * cell against `colorDepth`, so one resolved theme serves every depth.
   */
  resolve(id: string, caps: TerminalCapabilities): ResolvedTheme {
    const key = `${id}:${caps.unicode}:${caps.colorDepth}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const chain: ThemeDefinition[] = [];
    let cursor = this.defs.get(id);
    const seen = new Set<string>();
    while (cursor && !seen.has(cursor.id)) {
      seen.add(cursor.id);
      chain.unshift(cursor);
      cursor = cursor.extends ? this.defs.get(cursor.extends) : undefined;
    }
    if (chain.length === 0) {
      throw new Error(`[textui] no theme registered as "${id}"`);
    }
    const leaf = chain[chain.length - 1] as ThemeDefinition;

    const colors = { ...FALLBACK_COLORS };
    let spacing = { ...DEFAULT_SPACING };
    let glyphOverrides: Partial<ThemeGlyphs> = {};
    let border: BorderStyle = 'single';
    let density: Density = 'normal';
    const components: Record<string, Record<string, Style>> = {};
    let syntaxOverrides: Partial<Record<SyntaxScope, StyleColor>> = {};

    for (const def of chain) {
      Object.assign(colors, def.colors);
      // A theme that restates the accent restates what the accent is *for*.
      //
      // `focus` and `cursor` have no identity of their own - a focus ring and
      // a caret are the accent, drawn somewhere. Left to a plain merge they
      // keep whatever the extended theme set, so `console` overrode accent to
      // teal and kept a blue focus ring, and `paper` went warm all over with a
      // blue caret still in it. Accent teal here and blue there, in one theme.
      //
      // Only these two. `selected` and `active` are backgrounds that have to
      // be dim or bright enough for the text on them, which is a decision
      // about contrast rather than hue - a theme picks those itself.
      const stated = def.colors ?? {};
      if (stated.accent !== undefined) {
        for (const token of FOLLOWS_ACCENT) {
          if (stated[token] === undefined) colors[token] = stated.accent;
        }
      }
      if (def.syntax) syntaxOverrides = { ...syntaxOverrides, ...def.syntax };
      if (def.spacing) spacing = { ...spacing, ...def.spacing };
      if (def.glyphs) glyphOverrides = { ...glyphOverrides, ...def.glyphs };
      if (def.border) border = def.border;
      if (def.density) density = def.density;
      for (const [name, variants] of Object.entries(def.components ?? {})) {
        components[name] = { ...components[name], ...variants };
      }
    }

    // A colourless terminal gets no colour, whatever the theme says.
    if (caps.colorDepth === 0) {
      for (const token of Object.keys(colors) as ColorToken[]) {
        colors[token] = 'default';
      }
    }

    const syntax = {} as Record<SyntaxScope, Color>;
    for (const [scope, token] of Object.entries(SYNTAX_DEFAULTS) as [SyntaxScope, ColorToken][]) {
      const override = syntaxOverrides[scope];
      syntax[scope] = override === undefined
        ? (colors[token] as Color)
        : ((typeof override === 'string' && override in colors
            ? colors[override as ColorToken]
            : override) as Color);
    }
    // A theme may name a literal colour for a scope, so blanking `colors` is
    // not enough to make a colourless terminal colourless.
    if (caps.colorDepth === 0) {
      for (const scope of Object.keys(syntax) as SyntaxScope[]) syntax[scope] = 'default';
    }

    const glyphs: ThemeGlyphs = { ...glyphsFor(caps.unicode), ...glyphOverrides };
    const charCache = new Map<BorderStyle, BorderChars>();

    const resolved: ResolvedTheme = {
      id: leaf.id,
      name: leaf.name,
      appearance: leaf.appearance,
      colors,
      spacing,
      glyphs,
      border,
      density,
      components,
      syntax,

      color(token: string): Color {
        if (token in colors) return colors[token as ColorToken] as Color;
        // Not a token: a literal colour passed straight through.
        return token as Color;
      },

      borderChars(style?: BorderStyle): BorderChars {
        const s = style ?? border;
        let chars = charCache.get(s);
        if (!chars) {
          const base = borderCharsFor(s, caps.unicode);
          const custom = leaf.borderChars?.[s];
          chars = custom ? { ...base, ...custom } : base;
          charCache.set(s, chars);
        }
        return chars;
      },

      styleFor(component: string, variants: string[] = []): Style {
        const entry = components[component];
        if (!entry) return {};
        let out: Style = { ...entry.base };
        for (const variant of variants) {
          if (entry[variant]) out = { ...out, ...entry[variant] };
        }
        return out;
      },
    };

    this.cache.set(key, resolved);
    return resolved;
  }
}

export function createThemes(initial?: ThemeDefinition[]): Themes {
  return new Themes(initial);
}
