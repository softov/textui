import type { TextWrap } from '../types/style.js';

/**
 * Terminal text measurement.
 *
 * Everything the layout engine knows about size comes from here, so the rules
 * are worth stating: a cell holds one grapheme cluster, a grapheme is 0, 1 or
 * 2 cells wide, and a string's width is the sum - never its `.length`.
 */

const segmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

/**
 * True for a string that is entirely printable ASCII.
 *
 * Worth asking, because the answer is yes for very nearly all of it: source
 * code, file names, labels, key hints. Every character is then one grapheme
 * one cell wide, and none of the Unicode machinery below has anything to do.
 */
function isAscii(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 0x20 || c > 0x7e) return false;
  }
  return true;
}

/**
 * Split into grapheme clusters. Falls back to code points without Intl.
 *
 * The ASCII path skips `Intl.Segmenter` entirely. It is not a micro-tweak:
 * painting walks the graphemes of every string on screen every frame, and
 * segmentation was measuring at about a sixth of the frame in a list of plain
 * ASCII rows - all of it spent proving that `r`, `o` and `w` are one character
 * each.
 */
export function graphemes(text: string): string[] {
  if (text === '') return [];
  if (isAscii(text)) return text.split('');
  if (segmenter) {
    const out: string[] = [];
    for (const { segment } of segmenter.segment(text)) out.push(segment);
    return out;
  }
  return Array.from(text);
}

// Zero-width: combining marks, variation selectors, ZWJ, control chars.
function isZeroWidth(cp: number): boolean {
  return (
    cp === 0x200b || cp === 0x200c || cp === 0x200d || cp === 0xfeff ||
    (cp >= 0x0300 && cp <= 0x036f) ||
    (cp >= 0x0483 && cp <= 0x0489) ||
    (cp >= 0x0591 && cp <= 0x05bd) ||
    (cp >= 0x0610 && cp <= 0x061a) ||
    (cp >= 0x064b && cp <= 0x065f) ||
    (cp >= 0x0e31 && cp <= 0x0e3a) ||
    (cp >= 0x1ab0 && cp <= 0x1aff) ||
    (cp >= 0x1dc0 && cp <= 0x1dff) ||
    (cp >= 0x20d0 && cp <= 0x20f0) ||
    (cp >= 0xfe00 && cp <= 0xfe0f) ||
    (cp >= 0xfe20 && cp <= 0xfe2f) ||
    (cp >= 0xe0100 && cp <= 0xe01ef)
  );
}

// East Asian Wide + Fullwidth, and the emoji ranges that render double-width.
function isWide(cp: number): boolean {
  return (
    (cp >= 0x1100 && cp <= 0x115f) ||
    (cp >= 0x2e80 && cp <= 0x303e) ||
    (cp >= 0x3041 && cp <= 0x33ff) ||
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0xa000 && cp <= 0xa4cf) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe10 && cp <= 0xfe19) ||
    (cp >= 0xfe30 && cp <= 0xfe6f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x1f300 && cp <= 0x1f64f) ||
    (cp >= 0x1f900 && cp <= 0x1f9ff) ||
    (cp >= 0x1fa70 && cp <= 0x1faff) ||
    (cp >= 0x20000 && cp <= 0x3fffd)
  );
}

/**
 * Width of one grapheme cluster in cells. A cluster is measured by its base
 * character; an emoji followed by VS16 counts as wide.
 */
export function graphemeWidth(cluster: string): number {
  if (cluster === '') return 0;
  /*
   * One printable ASCII character is one cell, and that is the overwhelming
   * majority of every cluster this is ever asked about.
   *
   * The general path below builds two arrays - `Array.from` then `.map` - for
   * every cluster, which is two allocations per cell per frame. Answering the
   * common case from the character code costs nothing and allocates nothing.
   */
  if (cluster.length === 1) {
    const only = cluster.charCodeAt(0);
    if (only >= 0x20 && only <= 0x7e) return 1;
  }
  const cps = Array.from(cluster).map((c) => c.codePointAt(0) as number);
  const base = cps[0] as number;
  if (base < 0x20 || base === 0x7f) return 0;
  if (isZeroWidth(base)) return 0;
  // VS16 promotes a text-presentation symbol to emoji presentation.
  if (cps.includes(0xfe0f)) return 2;
  if (isWide(base)) return 2;
  return 1;
}

/** Width of a string in terminal cells. */
export function stringWidth(text: string): number {
  if (text === '') return 0;
  // Fast path: pure ASCII printable.
  if (isAscii(text)) return text.length;

  let w = 0;
  for (const g of graphemes(text)) w += graphemeWidth(g);
  return w;
}

/** Take at most `width` cells from the front. Never splits a wide grapheme. */
export function sliceByWidth(text: string, width: number): string {
  if (width <= 0) return '';
  if (stringWidth(text) <= width) return text;
  let out = '';
  let w = 0;
  for (const g of graphemes(text)) {
    const gw = graphemeWidth(g);
    if (w + gw > width) break;
    out += g;
    w += gw;
  }
  return out;
}

/**
 * The slice of `text` covering display columns `[start, start + width)`.
 *
 * Cutting by index is wrong the moment a line contains a wide character: the
 * horizontal scroll would drift against the gutter, one cell per CJK glyph.
 * A wide grapheme straddling either edge is dropped rather than split, because
 * half of one cannot be drawn.
 */
export function sliceColumns(text: string, start: number, width: number): string {
  if (width <= 0) return '';
  const end = start + width;
  let column = 0;
  let out = '';

  for (const g of graphemes(text)) {
    const gw = graphemeWidth(g);
    if (gw === 0) {
      // A combining mark belongs to the grapheme before it, if that survived.
      if (out !== '') out += g;
      continue;
    }

    const next = column + gw;
    if (next <= start) {
      column = next;
      continue;
    }
    if (column >= end) break;

    if (column >= start && next <= end) {
      out += g;
    } else {
      // A wide grapheme half inside the window becomes blanks for the half
      // that shows. Splitting it is impossible and dropping it silently would
      // slide the rest of the line one cell against the gutter.
      out += ' '.repeat(Math.min(next, end) - Math.max(column, start));
    }
    column = next;
  }
  return out;
}

/**
 * Replace tabs with spaces to the next tab stop.
 *
 * A terminal cell is one column, so a raw tab is one blank cell and every
 * indented line lands in a different place than it does in an editor. Doing
 * this before highlighting keeps token offsets and screen columns the same
 * number.
 */
export function expandTabs(text: string, tabWidth = 4): string {
  if (!text.includes('\t')) return text;
  const width = Math.max(1, tabWidth);

  return text
    .split('\n')
    .map((line) => {
      if (!line.includes('\t')) return line;
      let out = '';
      let column = 0;
      for (const g of graphemes(line)) {
        if (g === '\t') {
          const advance = width - (column % width);
          out += ' '.repeat(advance);
          column += advance;
          continue;
        }
        out += g;
        column += graphemeWidth(g);
      }
      return out;
    })
    .join('\n');
}

export type TruncateSide = 'end' | 'start' | 'middle';

/** Fit into `width` cells, marking the cut with `ellipsis`. */
export function truncate(
  text: string,
  width: number,
  ellipsis = '…',
  side: TruncateSide = 'end',
): string {
  const total = stringWidth(text);
  if (total <= width) return text;
  if (width <= 0) return '';
  const ew = stringWidth(ellipsis);
  if (width <= ew) return sliceByWidth(ellipsis, width);

  // A space either side of the ellipsis is a typographic mistake, not a cell
  // of content, so the cut is tidied before the mark goes on. It also means a
  // truncated string can come back narrower than `width`, which is correct:
  // `width` is a limit, and nothing here is padding.
  const keep = width - ew;
  if (side === 'end') return sliceByWidth(text, keep).trimEnd() + ellipsis;

  const gs = graphemes(text);
  if (side === 'start') {
    let w = 0;
    let i = gs.length;
    while (i > 0 && w + graphemeWidth(gs[i - 1] as string) <= keep) {
      i--;
      w += graphemeWidth(gs[i] as string);
    }
    return ellipsis + gs.slice(i).join('').trimStart();
  }

  const left = Math.ceil(keep / 2);
  const right = keep - left;
  let w = 0;
  let j = gs.length;
  while (j > 0 && w + graphemeWidth(gs[j - 1] as string) <= right) {
    j--;
    w += graphemeWidth(gs[j] as string);
  }
  return sliceByWidth(text, left).trimEnd() + ellipsis + gs.slice(j).join('').trimStart();
}

/** Pad to exactly `width` cells. Over-long input is returned unchanged. */
export function padTo(
  text: string,
  width: number,
  align: 'left' | 'center' | 'right' = 'left',
  fill = ' ',
): string {
  const w = stringWidth(text);
  if (w >= width) return text;
  const pad = width - w;
  if (align === 'left') return text + fill.repeat(pad);
  if (align === 'right') return fill.repeat(pad) + text;
  const left = Math.floor(pad / 2);
  return fill.repeat(left) + text + fill.repeat(pad - left);
}

/** Fit to exactly `width`: truncate when long, pad when short. */
export function fitTo(
  text: string,
  width: number,
  align: 'left' | 'center' | 'right' = 'left',
  ellipsis = '…',
): string {
  return padTo(truncate(text, width, ellipsis), width, align);
}

export type WrapMode = 'none' | 'word' | 'char';

/**
 * The end a `TextWrap` cuts at, or `undefined` when it wraps instead.
 *
 * The wrapping modes and the truncating ones live in one union because they
 * answer one question - what happens at the edge - and a component that had to
 * take both a `wrap` and a `truncate` prop could be handed the two answers at
 * once. These two helpers are how the union is taken apart again.
 */
export function truncateSideOf(wrap: TextWrap | undefined): TruncateSide | undefined {
  switch (wrap) {
    case 'truncate': case 'truncate-end': return 'end';
    case 'truncate-start': return 'start';
    case 'truncate-middle': return 'middle';
    default: return undefined;
  }
}

/** The mode `wrapText` should run in. A truncating text does not wrap at all. */
export function wrapModeOf(wrap: TextWrap | undefined): WrapMode {
  return wrap === 'word' || wrap === 'char' ? wrap : 'none';
}

/** Break into lines of at most `width` cells. Honours existing newlines. */
export function wrapText(text: string, width: number, mode: WrapMode = 'word'): string[] {
  if (width <= 0) return [];
  const paragraphs = text.split('\n');
  if (mode === 'none') return paragraphs;

  const out: string[] = [];
  for (const para of paragraphs) {
    if (para === '') { out.push(''); continue; }
    if (stringWidth(para) <= width) { out.push(para); continue; }

    if (mode === 'char') {
      let rest = para;
      while (stringWidth(rest) > width) {
        const head = sliceByWidth(rest, width);
        out.push(head);
        rest = rest.slice(head.length);
      }
      if (rest !== '') out.push(rest);
      continue;
    }

    // word wrap; a word longer than the line falls back to char wrap
    let line = '';
    let lineW = 0;
    for (const word of para.split(/(\s+)/)) {
      if (word === '') continue;
      const ww = stringWidth(word);
      const isSpace = /^\s+$/.test(word);

      if (lineW + ww <= width) {
        line += word;
        lineW += ww;
        continue;
      }
      if (isSpace) {
        out.push(line.trimEnd());
        line = '';
        lineW = 0;
        continue;
      }
      if (line !== '') { out.push(line.trimEnd()); line = ''; lineW = 0; }
      if (ww <= width) { line = word; lineW = ww; continue; }

      let rest = word;
      while (stringWidth(rest) > width) {
        const head = sliceByWidth(rest, width);
        out.push(head);
        rest = rest.slice(head.length);
      }
      line = rest;
      lineW = stringWidth(rest);
    }
    if (line !== '') out.push(line.trimEnd());
  }
  return out;
}

// CSI / OSC / SS2 / SS3 and friends. Input sanitation only, never output.
const ANSI_RE =
  // eslint-disable-next-line no-control-regex
  /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~]|\][^\x07\x1B]*(?:\x07|\x1B\\))/g;

export function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, '');
}

/** Remove control characters that would corrupt the frame. Keeps newlines. */
export function sanitize(text: string): string {
  // eslint-disable-next-line no-control-regex
  return stripAnsi(text).replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '');
}

/** Repeat a grapheme to exactly `width` cells (wide chars land short). */
export function repeatToWidth(char: string, width: number): string {
  if (width <= 0) return '';
  const w = graphemeWidth(char) || 1;
  return char.repeat(Math.max(0, Math.floor(width / w)));
}
