import type { ThemeDefinition } from '../types/theme.js';

/**
 * The built-in themes.
 *
 * `dark` and `light` are the two bases; everything else extends one of them
 * and restates only what it changes. The three that follow exist because the
 * same application should be able to look like a dense operator console, an
 * airy report or a workbench without a component knowing which - so the
 * difference lives here, in border style and density, not in the catalog.
 */

export const DARK: ThemeDefinition = {
  id: 'dark',
  name: 'Dark',
  appearance: 'dark',
  border: 'single',
  density: 'normal',
  colors: {
    canvas: '#0d1117',
    surface: '#161b22',
    surfaceAlt: '#1c2128',
    overlay: '#1c2128',
    border: '#30363d',
    borderStrong: '#484f58',
    borderSubtle: '#21262d',
    divider: '#484f58',
    text: '#e6edf3',
    muted: '#8b949e',
    subtle: '#6e7681',
    inverted: '#0d1117',
    accent: '#58a6ff',
    primary: '#388bfd',
    secondary: '#a371f7',
    success: '#3fb950',
    warning: '#d29922',
    danger: '#f85149',
    info: '#58a6ff',
    onAccent: '#0d1117',
    onDefault: '#0d1117',
    onPrimary: '#0d1117',
    onSecondary: '#0d1117',
    onMuted: '#0d1117',
    onSuccess: '#0d1117',
    onInfo: '#0d1117',
    onWarning: '#0d1117',
    onDanger: '#0d1117',
    hover: '#1f2937',
    active: '#264466',
    selected: '#1f6feb',
    focus: '#58a6ff',
    disabled: '#484f58',
    scrim: '#010409',
    cursor: '#58a6ff',
    shadow: '#010409',
  },
  spacing: { none: 0, xs: 0, sm: 1, md: 1, lg: 2, xl: 3 },
};

export const LIGHT: ThemeDefinition = {
  id: 'light',
  name: 'Light',
  appearance: 'light',
  border: 'single',
  density: 'normal',
  colors: {
    canvas: '#ffffff',
    surface: '#f6f8fa',
    surfaceAlt: '#eaeef2',
    overlay: '#ffffff',
    border: '#d0d7de',
    borderStrong: '#8c959f',
    borderSubtle: '#eaeef2',
    divider: '#8c959f',
    text: '#1f2328',
    muted: '#656d76',
    subtle: '#8c959f',
    inverted: '#ffffff',
    accent: '#0969da',
    primary: '#0969da',
    secondary: '#8250df',
    success: '#1a7f37',
    warning: '#faca00',
    danger: '#e95c5e',
    info: '#0969da',
    onAccent: '#ffffff',
    onDefault: '#ffffff',
    onPrimary: '#ffffff',
    onSecondary: '#ffffff',
    onMuted: '#ffffff',
    onSuccess: '#ffffff',
    onInfo: '#ffffff',
    onWarning: '#ffffff',
    onDanger: '#ffffff',
    hover: '#eaeef2',
    active: '#dbeafe',
    selected: '#0969da',
    focus: '#0969da',
    disabled: '#8c959f',
    scrim: '#8c959f',
    cursor: '#0969da',
    shadow: '#d0d7de',
  },
  spacing: { none: 0, xs: 0, sm: 1, md: 1, lg: 2, xl: 3 },
};

/** Dense, bordered, high contrast. Every region is a labelled box. */
export const CONSOLE: ThemeDefinition = {
  id: 'console',
  name: 'Console',
  appearance: 'dark',
  extends: 'dark',
  border: 'single',
  density: 'compact',
  colors: {
    canvas: '#000000',
    surface: '#0a0e14',
    border: '#3b4252',
    borderStrong: '#5e81ac',
    divider: '#5e81ac',
    accent: '#88c0d0',
    text: '#d8dee9',
    muted: '#616e88',
    // The accent is teal, so the things made of it are too. Inheriting these
    // from `dark` is what left a teal underline over a blue focus ring and a
    // blue selected row - one theme wearing two accents.
    //
    // The two selection backgrounds are picked rather than derived: `selected`
    // carries `inverted` text so it has to be light, and `active` carries
    // `text` so it has to be dark. Same hue, opposite ends.
    primary: '#88c0d0',
    info: '#88c0d0',
    selected: '#6ba3b2',
    active: '#1e3d47',
    onAccent: '#0a0e14',
    onPrimary: '#0a0e14',
    onInfo: '#0a0e14',
    hover: '#141a21',
  },
  spacing: { none: 0, xs: 0, sm: 0, md: 1, lg: 1, xl: 2 },
  components: {
    Panel: { base: { border: 'single', padding: 0 } },
    Button: { base: { padding: [0, 1] } },
  },
};

/** Borderless. Whitespace and alignment do the separating. */
export const PAPER: ThemeDefinition = {
  id: 'paper',
  name: 'Paper',
  appearance: 'dark',
  extends: 'dark',
  border: 'none',
  density: 'airy',
  colors: {
    canvas: 'default',
    surface: 'default',
    surfaceAlt: 'default',
    overlay: 'default',
    border: 'default',
    borderStrong: 'default',
    borderSubtle: 'default',
    divider: 'default',
    text: 'default',
    muted: '#9b949e',
    subtle: '#a7a7a7',
    inverted: '#0d1117',
    accent: '#58a6ff',
    primary: '#388bfd',
    secondary: '#a371f7',
    success: '#3fb950',
    warning: '#d29922',
    danger: '#f85149',
    info: '#58a6ff',
    onAccent: '#0d1117',
    onDefault: '#0d1117',
    onPrimary: '#0d1117',
    onSecondary: '#0d1117',
    onMuted: '#0d1117',
    onSuccess: '#0d1117',
    onInfo: '#0d1117',
    onWarning: '#0d1117',
    onDanger: '#0d1117',
    hover: '#1f2937',
    active: '#264466',
    selected: '#1f6feb',
    focus: '#58a6ff',
    disabled: '#484f58',
    scrim: '#010409',
    cursor: 'default',
    shadow: '#010409',
  },
  spacing: { none: 0, xs: 1, sm: 1, md: 2, lg: 3, xl: 4 },
  components: {
    Panel: { base: { border: 'none', padding: [1, 2] } },
    Button: { base: { padding: [0, 2] } },
  },
};

/** Borderless. Whitespace and alignment do the separating. */
export const PAPER_LIGHT: ThemeDefinition = {
  id: 'paper-light',
  name: 'Paper Light',
  appearance: 'light',
  extends: 'light',
  border: 'none',
  density: 'airy',
  colors: {
    canvas: '#fffdf9',
    surface: '#fffdf9',
    surfaceAlt: '#f5f2ec',
    border: '#e5e0d8',
    borderSubtle: '#f0ece5',
    divider: 'default',
    subtle: '#c56532',
    text: '#2b2a27',
    muted: '#7a756c',
    accent: '#b4531f',
    primary: '#b4531f',
    // Selection as a tint of the page, not a block of another colour.
    // `paper` inherits from `light`, whose selection is a saturated blue -
    // dropped onto cream it reads as damage rather than as a highlight, and
    // every component that fills with `selected` inherits that.
    hover: '#f7f1e7',
    active: '#efe4d2',
    selected: '#eadcc6',
    inverted: '#2b2a27',
    focus: '#b4531f',
  },
  spacing: { none: 0, xs: 1, sm: 1, md: 2, lg: 3, xl: 4 },
  components: {
    Panel: { base: { border: 'none', padding: [1, 2] } },
    Button: { base: { padding: [0, 2] } },
  },
};

/** Rounded chrome around a persistent frame. */
export const WORKBENCH: ThemeDefinition = {
  id: 'workbench',
  name: 'Workbench',
  appearance: 'dark',
  extends: 'dark',
  border: 'round',
  density: 'normal',
  colors: {
    canvas: '#1e1e2e',
    surface: '#181825',
    surfaceAlt: '#313244',
    overlay: '#181825',
    border: '#45475a',
    borderStrong: '#585b70',
    divider: '#585b70',
    text: '#cdd6f4',
    muted: '#a6adc8',
    subtle: '#6c7086',
    accent: '#89b4fa',
    primary: '#89b4fa',
    secondary: '#cba6f7',
    success: '#a6e3a1',
    warning: '#f9e2af',
    danger: '#f38ba8',
    info: '#89dceb',
    hover: '#313244',
    active: '#45475a',
    selected: '#585b70',
    focus: '#89b4fa',
    scrim: '#11111b',
  },
  components: {
    Panel: { base: { border: 'round' } },
  },
};

/** No colour at all. What a `colorDepth: 0` terminal or a pipe gets. */
export const MONO: ThemeDefinition = {
  id: 'mono',
  name: 'Monochrome',
  appearance: 'dark',
  border: 'ascii',
  cursor: 'underline',
  // Chosen, not downgraded to: this theme is ascii on a terminal that could
  // draw anything, so the rule has to say so too.
  divider: 'ascii',
  density: 'normal',
  colors: {
    canvas: 'default',
    surface: 'default',
    surfaceAlt: 'default',
    overlay: 'default',
    border: 'default',
    borderStrong: 'default',
    borderSubtle: 'default',
    divider: 'default',
    text: 'default',
    muted: 'default',
    subtle: 'default',
    inverted: 'default',
    accent: 'default',
    primary: 'default',
    secondary: 'default',
    success: 'default',
    warning: 'default',
    danger: 'default',
    info: 'default',
    onAccent: 'default',
    onPrimary: 'default',
    onSuccess: 'default',
    onWarning: 'default',
    onDanger: 'default',
    onInfo: 'default',
    hover: 'default',
    active: 'default',
    selected: 'default',
    focus: 'default',
    disabled: 'default',
    scrim: 'default',
    cursor: 'default',
    shadow: 'default',
  },
};

/**
 * Paper, after dark.
 *
 * The same airy, borderless, warm-accented character as `paper` - the point of
 * it is the restraint, not the brightness - with the ink and the page swapped.
 * A warm dark rather than a blue one, so the two read as one family and a
 * reader moving between them is not moving between two different products.
 */
export const PAPER_DARK: ThemeDefinition = {
  id: 'paper-dark',
  name: 'Paper Dark',
  appearance: 'dark',
  extends: 'dark',
  border: 'none',
  density: 'airy',
  colors: {
    canvas: '#1c1a17',
    surface: '#1c1a17',
    surfaceAlt: '#26231f',
    border: '#3a352e',
    borderSubtle: '#2a2621',
    divider: 'default',
    subtle: '#db8c4c',
    text: '#e8e3d9',
    muted: '#9a9287',
    accent: '#e0873f',
    primary: '#e0873f',
    // The same restraint, the other way up.
    hover: '#26231f',
    active: '#332e27',
    selected: '#3d362c',
    inverted: '#f4efe6',
    focus: '#e0873f',
  },
  spacing: { none: 0, xs: 1, sm: 1, md: 2, lg: 3, xl: 4 },
  components: {
    Panel: { base: { border: 'none', padding: [1, 2] } },
    Button: { base: { padding: [0, 2] } },
  },
};

export const BUILTIN_THEMES: ThemeDefinition[] = [
  DARK, LIGHT, CONSOLE, PAPER, PAPER_LIGHT, PAPER_DARK, WORKBENCH, MONO,
];
