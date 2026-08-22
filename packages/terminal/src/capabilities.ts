import type { CapabilityOverrides, TerminalCapabilities, ColorDepth, UnicodeLevel } from '@textui/core';
import { MINIMAL_CAPABILITIES } from '@textui/core';

export interface DetectionInput {
  env: Record<string, string | undefined>;
  isTTY: boolean;
  columns?: number;
  rows?: number;
  platform?: string;
}

/**
 * Capability detection.
 *
 * Detection is best-effort and deliberately conservative: claiming a
 * capability the terminal lacks corrupts the frame, while missing one only
 * costs polish. Anything detection cannot settle, an adapter override can.
 */
export function detectColorDepth(env: Record<string, string | undefined>, isTTY: boolean): ColorDepth {
  if (env.NO_COLOR !== undefined && env.NO_COLOR !== '') return 0;
  if (env.FORCE_COLOR !== undefined) {
    const level = Number.parseInt(env.FORCE_COLOR, 10);
    if (env.FORCE_COLOR === 'true') return 24;
    if (level === 0) return 0;
    if (level === 1) return 4;
    if (level === 2) return 8;
    if (level >= 3) return 24;
  }
  if (!isTTY) return 0;

  const term = env.TERM ?? '';
  if (term === 'dumb') return 0;

  const colorterm = (env.COLORTERM ?? '').toLowerCase();
  if (colorterm === 'truecolor' || colorterm === '24bit') return 24;

  const program = env.TERM_PROGRAM ?? '';
  if (['iTerm.app', 'WezTerm', 'vscode', 'Hyper', 'ghostty'].includes(program)) return 24;
  if (env.WT_SESSION) return 24;
  if (env.KITTY_WINDOW_ID) return 24;
  if (env.ALACRITTY_LOG || term.startsWith('alacritty')) return 24;

  if (term.includes('256')) return 8;
  if (term.includes('color') || term.startsWith('xterm') || term.startsWith('screen')) return 4;
  if (term === '') return 0;
  return 4;
}

export function detectUnicode(env: Record<string, string | undefined>): UnicodeLevel {
  const locale = env.LC_ALL ?? env.LC_CTYPE ?? env.LANG ?? '';
  if (!/utf-?8/i.test(locale)) {
    // Windows Terminal and modern macOS terminals are UTF-8 without saying so.
    if (env.WT_SESSION || env.TERM_PROGRAM === 'iTerm.app' || env.TERM_PROGRAM === 'Apple_Terminal') {
      return 'full';
    }
    return 'ascii';
  }
  const term = env.TERM ?? '';
  if (term === 'linux') return 'bmp';
  return 'full';
}

/**
 * Some terminals report a TERM their multiplexer chose. tmux and screen pass
 * most sequences through but swallow a few, so they are treated as capable
 * with the known gaps closed.
 */
function inMultiplexer(env: Record<string, string | undefined>): boolean {
  return Boolean(env.TMUX) || (env.TERM ?? '').startsWith('screen');
}

export function detectCapabilities(input: DetectionInput): TerminalCapabilities {
  const { env, isTTY } = input;
  const term = env.TERM ?? '';

  if (!isTTY || term === 'dumb') {
    return { ...MINIMAL_CAPABILITIES, colorDepth: detectColorDepth(env, isTTY) };
  }

  const colorDepth = detectColorDepth(env, isTTY);
  const unicode = detectUnicode(env);
  const mux = inMultiplexer(env);
  const program = env.TERM_PROGRAM ?? '';

  // Terminals that speak the kitty keyboard protocol, which is what makes
  // `ctrl+enter` a different key from `enter` rather than the same byte.
  //
  // VS Code belongs here: its terminal is xterm.js, which has implemented the
  // protocol since 6.1, and `terminal.integrated.enableKittyKeyboardProtocol`
  // defaults to on. Without it in this list nothing ever pushes `CSI > 1 u`,
  // so the terminal keeps sending legacy codes and every modified enter,
  // tab and escape arrives as its unmodified twin.
  const kitty = Boolean(env.KITTY_WINDOW_ID) || program === 'WezTerm'
    || program === 'ghostty' || program === 'vscode';
  const modern =
    kitty || program === 'iTerm.app' || Boolean(env.WT_SESSION) ||
    term.startsWith('alacritty') || program === 'vscode';

  return {
    colorDepth,
    unicode,
    wideChars: unicode !== 'ascii',
    mouse: true,
    wheel: true,
    focusEvents: true,
    paste: true,
    // tmux rewrites OSC 8, and Apple Terminal ignores it.
    hyperlinks: modern && !mux && program !== 'Apple_Terminal',
    clipboard: modern || mux,
    altScreen: true,
    cursor: true,
    // Synchronized output is safe when supported and harmless when not, but
    // tmux below 3.4 mangles it, so it is off inside a multiplexer.
    synchronizedOutput: modern && !mux,
    title: true,
    kittyKeyboard: kitty && !mux,
  };
}

export function applyOverrides(
  base: TerminalCapabilities,
  overrides: CapabilityOverrides | undefined,
): TerminalCapabilities {
  return overrides ? { ...base, ...overrides } : base;
}

/** Describe the environment, for `textui doctor` and the inspector. */
export function describeEnvironment(input: DetectionInput): Record<string, string> {
  const { env } = input;
  return {
    TERM: env.TERM ?? '(unset)',
    COLORTERM: env.COLORTERM ?? '(unset)',
    TERM_PROGRAM: env.TERM_PROGRAM ?? '(unset)',
    LANG: env.LC_ALL ?? env.LANG ?? '(unset)',
    multiplexer: env.TMUX ? 'tmux' : (env.TERM ?? '').startsWith('screen') ? 'screen' : 'none',
    ssh: env.SSH_TTY || env.SSH_CONNECTION ? 'yes' : 'no',
    tty: String(input.isTTY),
    size: `${input.columns ?? '?'}x${input.rows ?? '?'}`,
  };
}
