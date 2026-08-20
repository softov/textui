import type { Frame, Run } from '@textui/core';
import type { TerminalCapabilities } from '@textui/core';
import { COLOR_DEFAULT, downsample, isRgb, unpackRgb } from '@textui/core';
import {
  ATTR_BLINK, ATTR_BOLD, ATTR_DIM, ATTR_HIDDEN, ATTR_INVERSE,
  ATTR_ITALIC, ATTR_STRIKE, ATTR_UNDERLINE,
} from '@textui/core';
import * as ansi from './ansi.js';

/**
 * Frame to bytes.
 *
 * The writer holds the terminal's current SGR state across runs and emits only
 * the difference, because a full reset per run is what makes a redraw flicker
 * on a slow link. Colour is reduced here, against the terminal's real depth -
 * no component ever picked a fallback.
 */
interface WriterState {
  fg: number;
  bg: number;
  attrs: number;
  link: string | undefined;
  x: number;
  y: number;
  valid: boolean;
}

function freshState(): WriterState {
  return { fg: COLOR_DEFAULT, bg: COLOR_DEFAULT, attrs: 0, link: undefined, x: -1, y: -1, valid: false };
}

function fgSequence(color: number, depth: TerminalCapabilities['colorDepth']): string {
  const c = downsample(color, depth);
  if (c === COLOR_DEFAULT) return `${ansi.SGR.fgDefault}`;
  if (isRgb(c)) {
    const [r, g, b] = unpackRgb(c);
    return `38;2;${r};${g};${b}`;
  }
  if (c < 8) return `${30 + c}`;
  if (c < 16) return `${90 + (c - 8)}`;
  return `38;5;${c}`;
}

function bgSequence(color: number, depth: TerminalCapabilities['colorDepth']): string {
  const c = downsample(color, depth);
  if (c === COLOR_DEFAULT) return `${ansi.SGR.bgDefault}`;
  if (isRgb(c)) {
    const [r, g, b] = unpackRgb(c);
    return `48;2;${r};${g};${b}`;
  }
  if (c < 8) return `${40 + c}`;
  if (c < 16) return `${100 + (c - 8)}`;
  return `48;5;${c}`;
}

const ATTR_ON: [number, number][] = [
  [ATTR_BOLD, SGRon(ansi.SGR.bold)],
  [ATTR_DIM, SGRon(ansi.SGR.dim)],
  [ATTR_ITALIC, SGRon(ansi.SGR.italic)],
  [ATTR_UNDERLINE, SGRon(ansi.SGR.underline)],
  [ATTR_BLINK, SGRon(ansi.SGR.blink)],
  [ATTR_INVERSE, SGRon(ansi.SGR.inverse)],
  [ATTR_HIDDEN, SGRon(ansi.SGR.hidden)],
  [ATTR_STRIKE, SGRon(ansi.SGR.strike)],
];

function SGRon(code: number): number {
  return code;
}

export class Writer {
  private state = freshState();

  constructor(private capabilities: TerminalCapabilities) {}

  setCapabilities(capabilities: TerminalCapabilities): void {
    this.capabilities = capabilities;
    this.invalidate();
  }

  /** Forget what we believe the terminal's state to be. After a resize. */
  invalidate(): void {
    this.state = freshState();
  }

  /** Encode a frame. Returns an empty string when nothing changed. */
  write(frame: Frame): string {
    if (frame.runs.length === 0 && !frame.cursor) return '';

    const out: string[] = [];
    const sync = this.capabilities.synchronizedOutput;
    if (sync) out.push(ansi.syncStart);

    // A frame is painted with the cursor hidden; showing it once at the end
    // is the difference between a steady caret and one that streaks.
    const hideForPaint = this.capabilities.cursor && frame.runs.length > 0;
    if (hideForPaint) out.push(ansi.cursorHide);

    for (const run of frame.runs) out.push(this.encodeRun(run));

    if (this.state.link !== undefined) {
      out.push(ansi.linkClose);
      this.state.link = undefined;
    }

    if (frame.cursor && this.capabilities.cursor) {
      out.push(ansi.cursorTo(frame.cursor.x, frame.cursor.y));
      this.state.x = frame.cursor.x;
      this.state.y = frame.cursor.y;
      if (frame.cursor.visible) out.push(ansi.cursorShow);
    }

    if (sync) out.push(ansi.syncEnd);
    return out.join('');
  }

  private encodeRun(run: Run): string {
    const out: string[] = [];
    const s = this.state;

    // Move only when we are not already where this run starts.
    if (!s.valid || s.y !== run.y || s.x !== run.x) {
      out.push(
        s.valid && s.y === run.y ? ansi.cursorColumn(run.x) : ansi.cursorTo(run.x, run.y),
      );
    }

    out.push(this.encodeStyle(run));

    if (this.capabilities.hyperlinks && run.link !== s.link) {
      out.push(run.link === undefined ? ansi.linkClose : ansi.linkOpen(run.link));
      s.link = run.link;
    }

    out.push(run.text);

    s.x = run.x + [...run.text].length;
    s.y = run.y;
    s.valid = true;
    return out.join('');
  }

  private encodeStyle(run: Run): string {
    const s = this.state;
    const codes: (string | number)[] = [];

    const attrsChanged = s.attrs !== run.attrs;
    if (attrsChanged) {
      const removed = s.attrs & ~run.attrs;
      // Turning several attributes off individually costs more than one reset
      // followed by re-stating what is still on.
      if (removed !== 0 && popcount(removed) > 1) {
        codes.push(ansi.SGR.reset);
        s.fg = COLOR_DEFAULT;
        s.bg = COLOR_DEFAULT;
        s.attrs = 0;
      } else if (removed !== 0) {
        if (removed & ATTR_BOLD) codes.push(ansi.SGR.noBold);
        if (removed & ATTR_DIM) codes.push(ansi.SGR.noBold);
        if (removed & ATTR_ITALIC) codes.push(ansi.SGR.noItalic);
        if (removed & ATTR_UNDERLINE) codes.push(ansi.SGR.noUnderline);
        if (removed & ATTR_BLINK) codes.push(ansi.SGR.noBlink);
        if (removed & ATTR_INVERSE) codes.push(ansi.SGR.noInverse);
        if (removed & ATTR_HIDDEN) codes.push(ansi.SGR.noHidden);
        if (removed & ATTR_STRIKE) codes.push(ansi.SGR.noStrike);
      }

      const added = run.attrs & ~s.attrs;
      for (const [bit, code] of ATTR_ON) {
        if (added & bit) codes.push(code);
      }
      s.attrs = run.attrs;
    }

    if (this.capabilities.colorDepth > 0) {
      if (s.fg !== run.fg) {
        codes.push(fgSequence(run.fg, this.capabilities.colorDepth));
        s.fg = run.fg;
      }
      if (s.bg !== run.bg) {
        codes.push(bgSequence(run.bg, this.capabilities.colorDepth));
        s.bg = run.bg;
      }
    }

    return codes.length === 0 ? '' : `${ansi.CSI}${codes.join(';')}m`;
  }
}

function popcount(n: number): number {
  let count = 0;
  let v = n;
  while (v) {
    v &= v - 1;
    count++;
  }
  return count;
}

export function createWriter(capabilities: TerminalCapabilities): Writer {
  return new Writer(capabilities);
}
