/**
 * ANSI escape sequences.
 *
 * Everything the writer can emit is named here, so a capability check happens
 * once - at the adapter - rather than scattered through the render path.
 * Sequences are written with `\x1b` escapes rather than literal bytes so this
 * file stays readable in a diff.
 */
export const ESC = '\x1b';
export const CSI = '\x1b[';
export const OSC = '\x1b]';
export const ST = '\x1b\\';
export const BEL = '\x07';

// --- cursor ---
export const cursorTo = (x: number, y: number): string => `${CSI}${y + 1};${x + 1}H`;
export const cursorHome = `${CSI}H`;
export const cursorHide = `${CSI}?25l`;
export const cursorShow = `${CSI}?25h`;
export const cursorSave = `${ESC}7`;
export const cursorRestore = `${ESC}8`;
export const cursorUp = (n = 1): string => `${CSI}${n}A`;
export const cursorDown = (n = 1): string => `${CSI}${n}B`;
export const cursorForward = (n = 1): string => `${CSI}${n}C`;
export const cursorBack = (n = 1): string => `${CSI}${n}D`;
export const cursorColumn = (x: number): string => `${CSI}${x + 1}G`;

/** Cursor shapes, for a text field that wants a bar rather than a block. */
export const cursorShape = (
  shape: 'block' | 'underline' | 'bar',
  blinking = true,
): string => {
  const base = shape === 'block' ? 1 : shape === 'underline' ? 3 : 5;
  return `${CSI}${blinking ? base : base + 1} q`;
};

// --- erasing ---
export const eraseLine = `${CSI}2K`;
export const eraseLineRight = `${CSI}0K`;
export const eraseScreen = `${CSI}2J`;
export const eraseDown = `${CSI}0J`;
export const scrollUp = (n = 1): string => `${CSI}${n}S`;

// --- modes ---
export const altScreenEnter = `${CSI}?1049h`;
export const altScreenLeave = `${CSI}?1049l`;
export const bracketedPasteOn = `${CSI}?2004h`;
export const bracketedPasteOff = `${CSI}?2004l`;
export const focusEventsOn = `${CSI}?1004h`;
export const focusEventsOff = `${CSI}?1004l`;

/** SGR mouse reporting: any-event tracking plus extended coordinates. */
export const mouseOn = `${CSI}?1000h${CSI}?1002h${CSI}?1003h${CSI}?1006h`;
export const mouseOff = `${CSI}?1006l${CSI}?1003l${CSI}?1002l${CSI}?1000l`;
/** Click and drag only - no motion events, which are noisy over ssh. */
export const mouseButtonsOn = `${CSI}?1000h${CSI}?1002h${CSI}?1006h`;
export const mouseButtonsOff = `${CSI}?1006l${CSI}?1002l${CSI}?1000l`;

/** DEC 2026: draw the whole frame before showing any of it. */
export const syncStart = `${CSI}?2026h`;
export const syncEnd = `${CSI}?2026l`;

/** Kitty keyboard protocol - disambiguates ctrl+i from tab, and so on. */
export const kittyKeyboardPush = `${CSI}>1u`;
export const kittyKeyboardPop = `${CSI}<u`;

export const wrapOff = `${CSI}?7l`;
export const wrapOn = `${CSI}?7h`;

// --- queries ---
export const queryDeviceAttributes = `${CSI}c`;
export const queryCursorPosition = `${CSI}6n`;
/** XTGETTCAP for truecolor support. */
export const queryTruecolor = `${ESC}P+q524742${ESC}\\`;
export const querySync = `${CSI}?2026$p`;

// --- osc ---
export const setTitle = (title: string): string => `${OSC}0;${sanitizeOsc(title)}${BEL}`;
export const link = (url: string, text: string): string =>
  `${OSC}8;;${sanitizeOsc(url)}${ST}${text}${OSC}8;;${ST}`;
export const linkOpen = (url: string): string => `${OSC}8;;${sanitizeOsc(url)}${ST}`;
export const linkClose = `${OSC}8;;${ST}`;

/** OSC 52: put text on the system clipboard, base64-encoded. */
export const clipboardWrite = (text: string): string => {
  const b64 = typeof globalThis.btoa === 'function'
    ? globalThis.btoa(unescape(encodeURIComponent(text)))
    : Buffer.from(text, 'utf8').toString('base64');
  return `${OSC}52;c;${b64}${BEL}`;
};

/** A string inside an OSC must not contain a terminator of its own. */
function sanitizeOsc(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\x00-\x1f\x7f]/g, '');
}

// --- SGR ---
export const reset = `${CSI}0m`;

export const SGR = {
  reset: 0,
  bold: 1,
  dim: 2,
  italic: 3,
  underline: 4,
  blink: 5,
  inverse: 7,
  hidden: 8,
  strike: 9,
  noBold: 22,
  noItalic: 23,
  noUnderline: 24,
  noBlink: 25,
  noInverse: 27,
  noHidden: 28,
  noStrike: 29,
  fgDefault: 39,
  bgDefault: 49,
} as const;
