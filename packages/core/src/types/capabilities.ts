/**
 * What this terminal can actually do. Detected where possible, overridable by
 * the adapter, and readable from the store at `$/modus/capabilities/*` so a
 * `when` clause and a layout can both branch on it.
 *
 * Components degrade against this; they never feature-detect on their own.
 */
export type ColorDepth = 0 | 4 | 8 | 24;

/** How much of the box-drawing / symbol repertoire is safe to emit. */
export type UnicodeLevel = 'ascii' | 'bmp' | 'full';

export interface TerminalCapabilities {
  /** 0 = monochrome, 4 = 16 colors, 8 = 256, 24 = truecolor. */
  colorDepth: ColorDepth;
  unicode: UnicodeLevel;
  /** True when the terminal reports (or is assumed to have) emoji/wide support. */
  wideChars: boolean;
  mouse: boolean;
  wheel: boolean;
  /** Terminal reports focus in/out (CSI ?1004h). */
  focusEvents: boolean;
  /** Bracketed paste (CSI ?2004h). */
  paste: boolean;
  /** OSC 8 hyperlinks. */
  hyperlinks: boolean;
  /** OSC 52 clipboard write. */
  clipboard: boolean;
  /** Alternate screen buffer (CSI ?1049h). */
  altScreen: boolean;
  /** Cursor show/hide/position. */
  cursor: boolean;
  /** Synchronized output (DEC 2026) - tear-free frames. */
  synchronizedOutput: boolean;
  /** Terminal supports setting the window/tab title (OSC 0/2). */
  title: boolean;
  /** Keyboard disambiguation (Kitty keyboard protocol). */
  kittyKeyboard: boolean;
}

export type CapabilityName = keyof TerminalCapabilities;

/** Partial override applied on top of detection. */
export type CapabilityOverrides = Partial<TerminalCapabilities>;

/** The most conservative terminal we still render correctly on. */
export const MINIMAL_CAPABILITIES: TerminalCapabilities = {
  colorDepth: 0,
  unicode: 'ascii',
  wideChars: false,
  mouse: false,
  wheel: false,
  focusEvents: false,
  paste: false,
  hyperlinks: false,
  clipboard: false,
  altScreen: false,
  cursor: true,
  synchronizedOutput: false,
  title: false,
  kittyKeyboard: false,
};

export const FULL_CAPABILITIES: TerminalCapabilities = {
  colorDepth: 24,
  unicode: 'full',
  wideChars: true,
  mouse: true,
  wheel: true,
  focusEvents: true,
  paste: true,
  hyperlinks: true,
  clipboard: true,
  altScreen: true,
  cursor: true,
  synchronizedOutput: true,
  title: true,
  kittyKeyboard: true,
};
