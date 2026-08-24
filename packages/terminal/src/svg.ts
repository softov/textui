import type { CellBuffer, Color, ColorDepth } from '@textui/core';
import {
  ATTR_BOLD, ATTR_DIM, ATTR_HIDDEN, ATTR_INVERSE, ATTR_ITALIC, ATTR_STRIKE,
  ATTR_UNDERLINE, COLOR_DEFAULT, downsample, mix, packColor, toHex,
} from '@textui/core';

/**
 * A frame, as a picture.
 *
 * `captureBuffer` writes a frame you can `cat`. This writes one you can put in
 * a README, and the difference matters more than it sounds: an `.ans` file is
 * only a screenshot on a terminal, so the place a terminal application most
 * needs to show what it looks like - a repository page, a docs site, a pull
 * request - is the one place it cannot.
 *
 * The output is one self-contained SVG with no external anything: no font file,
 * no stylesheet, no script. That is what lets it survive GitHub, which serves
 * markdown images from a sanitising proxy that fetches nothing on the page's
 * behalf.
 *
 * It is also **text**, which is the part worth having. A committed SVG diffs:
 * a change that moves a column or recolours a token shows up as a changed line
 * in review, so a screenshot in the docs can be checked by CI rather than
 * re-taken by hand and trusted.
 */
export interface SvgOptions {
  /**
   * Cell size in pixels. The defaults are close to a 13px monospace face at a
   * normal line height, which is what makes the picture look like a terminal
   * rather than like text that happens to be in a grid.
   */
  cellWidth?: number;
  cellHeight?: number;
  fontSize?: number;
  /**
   * The font stack. No web font by default and none recommended: a font that
   * has to be fetched is a font that is missing exactly where this file is
   * most useful, and a missing monospace font takes the column alignment with
   * it.
   */
  fontFamily?: string;
  /**
   * Where the baseline sits inside the cell, as a fraction of its height.
   *
   * A number rather than `dominant-baseline`, which renderers disagree about
   * enough that the text lands a pixel or two off between two viewers of the
   * same file.
   */
  baseline?: number;
  /** Space around the grid, in pixels. */
  padding?: number;
  /** Corner radius on the backdrop. Zero is a square edge. */
  radius?: number;
  /**
   * What a cell left at the terminal's own colours becomes.
   *
   * A terminal has no answer for this - "default" means whatever the emulator
   * is configured with - so a picture has to choose, and the honest choice is
   * the caller's. These are what the theme would call `background` and `text`.
   *
   * Passing `default` here is the one thing that cannot work, and a theme can
   * hand it over without meaning to: `mono` is *made* of `default`, so
   * `theme.colors.canvas` and `theme.colors.text` are both it. Either one is
   * replaced with the exporter's own, because a picture with no ink is a
   * rectangle.
   */
  background?: Color;
  foreground?: Color;
  /**
   * Reduce colour first, to show what a shallower terminal would have shown.
   * Left off, nothing is reduced: an SVG has no colour limit of its own, so
   * downsampling by default would be inventing a constraint.
   */
  colorDepth?: ColorDepth;
  /** An accessible name, emitted as `<title>`. */
  title?: string;
}

interface Run {
  /** Column the run starts at, and how many columns it covers. */
  x: number;
  columns: number;
  text: string;
  fg: number;
  attrs: number;
  /** Drawn with the box and block glyphs rather than with letters. */
  graphic: boolean;
}

const DEFAULTS = {
  cellWidth: 8,
  cellHeight: 17,
  fontSize: 13,
  fontFamily:
    "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'DejaVu Sans Mono', monospace",
  baseline: 0.78,
  padding: 10,
  radius: 6,
  background: '#0d1117',
  foreground: '#c9d1d9',
} as const;

export function bufferToSvg(buffer: CellBuffer, options: SvgOptions = {}): string {
  const cw = options.cellWidth ?? DEFAULTS.cellWidth;
  const ch = options.cellHeight ?? DEFAULTS.cellHeight;
  const fontSize = options.fontSize ?? DEFAULTS.fontSize;
  const fontFamily = options.fontFamily ?? DEFAULTS.fontFamily;
  const baseline = options.baseline ?? DEFAULTS.baseline;
  const pad = options.padding ?? DEFAULTS.padding;
  const radius = options.radius ?? DEFAULTS.radius;
  const depth = options.colorDepth;

  const width = buffer.width * cw + pad * 2;
  const height = buffer.height * ch + pad * 2;

  // Packed, so `inverse` and `dim` are worked out in the same space as every
  // other colour rather than as a special case per attribute. `Color` rather
  // than a hex string because that is what a theme holds: `theme.colors.canvas`
  // goes straight in.
  const paperPacked = given(options.background, DEFAULTS.background);
  const inkPacked = given(options.foreground, DEFAULTS.foreground);
  const paper = toHex(paperPacked);
  const reduce = (c: number): number => (depth === undefined ? c : downsample(c, depth));

  const out: string[] = [];
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" `
    + `viewBox="0 0 ${width} ${height}" font-family="${escape(fontFamily)}" `
    + `font-size="${fontSize}px">`,
  );
  if (options.title !== undefined) out.push(`<title>${escape(options.title)}</title>`);
  out.push(
    `<rect width="${width}" height="${height}"`
    + `${radius > 0 ? ` rx="${radius}"` : ''} fill="${paper}"/>`,
  );

  for (let y = 0; y < buffer.height; y++) {
    // Backgrounds first and for the whole row, because a glyph drawn over a
    // rect emitted later would be painted out: SVG has no z-index, only
    // document order.
    for (const run of backgroundRuns(buffer, y, paperPacked, inkPacked, reduce)) {
      out.push(
        `<rect x="${pad + run.x * cw}" y="${pad + y * ch}" `
        + `width="${run.columns * cw}" height="${ch}" fill="${toHex(run.fg)}"/>`,
      );
    }
  }

  const textY = (y: number): number => Math.round(pad + y * ch + ch * baseline);

  for (let y = 0; y < buffer.height; y++) {
    for (const run of glyphRuns(buffer, y, paperPacked, inkPacked, reduce)) {
      const decoration = [
        (run.attrs & ATTR_UNDERLINE) !== 0 ? 'underline' : '',
        (run.attrs & ATTR_STRIKE) !== 0 ? 'line-through' : '',
      ].filter(Boolean).join(' ');

      out.push(
        `<text x="${pad + run.x * cw}" y="${textY(y)}" fill="${toHex(run.fg)}"`
        + ((run.attrs & ATTR_BOLD) !== 0 ? ' font-weight="bold"' : '')
        + ((run.attrs & ATTR_ITALIC) !== 0 ? ' font-style="italic"' : '')
        + (decoration !== '' ? ` text-decoration="${decoration}"` : '')
        // The run is told how wide it is, in columns, so the grid holds even
        // where the reader's monospace font has a different advance width from
        // the one `cellWidth` was picked for.
        //
        // Which of the two adjustments only matters when the font is already
        // wrong - where the run's natural width is the right one, both are no
        // ops - and then the two kinds of run want opposite things. Letters
        // want `spacing`: looser tracking is readable and squashed letterforms
        // are not. A bar or a border wants `spacingAndGlyphs`: spacing a run of
        // blocks apart is how a solid bar comes out striped and a box's sides
        // stop meeting its corners, and a block stretched to its cell is still
        // a block.
        + ` textLength="${run.columns * cw}"`
        + ` lengthAdjust="${run.graphic ? 'spacingAndGlyphs' : 'spacing'}"`
        // Leading spaces inside a run are part of the picture, and the default
        // is to collapse them.
        + ` xml:space="preserve">${escape(run.text)}</text>`,
      );
    }
  }

  out.push('</svg>');
  return out.join('\n');
}

/**
 * A colour the picture can actually use.
 *
 * `toHex` has nothing to return for `default` and returns black, so a `default`
 * that reaches the file makes paper and ink the same colour and the whole
 * frame disappears into the backdrop. That is not a colour the caller chose; it
 * is the caller having no colour to give, which is what the fallback is for.
 */
function given(color: Color | undefined, fallback: Color): number {
  const packed = packColor(color ?? fallback);
  return packed === COLOR_DEFAULT ? packColor(fallback) : packed;
}

/**
 * The colours a cell actually paints with.
 *
 * `inverse` is resolved here rather than at either end: it swaps the pair, and
 * a cell that inverts while leaving one side at the terminal default is
 * swapping *that* default in - which is only knowable once both have been
 * filled in. Doing it later would invert a colour against itself.
 */
function colorsOf(
  fg: number, bg: number, attrs: number, paper: number, ink: number,
): { fg: number; bg: number } {
  let front = fg === COLOR_DEFAULT ? ink : fg;
  let back = bg === COLOR_DEFAULT ? paper : bg;
  if ((attrs & ATTR_INVERSE) !== 0) [front, back] = [back, front];
  // Dim is a reduced intensity, which on a picture is a colour part of the way
  // to the one behind it - there is no "half as bright" for an arbitrary hex.
  if ((attrs & ATTR_DIM) !== 0) front = mix(front, back, 0.5);
  return { fg: front, bg: back };
}

/** Background rects for one row, coalesced, skipping the paper colour. */
function backgroundRuns(
  buffer: CellBuffer, y: number, paper: number, ink: number,
  reduce: (c: number) => number,
): Run[] {
  const runs: Run[] = [];
  let open: Run | null = null;

  for (let x = 0; x < buffer.width; x++) {
    const cell = buffer.get(x, y);
    // A continuation cell has no colours of its own - it is the right half of
    // the glyph before it, and that cell's run already covers this column.
    if (cell?.continuation === true) {
      if (open) open.columns += 1;
      continue;
    }

    // Reduced first, resolved after. A shallower terminal shrinks the palette
    // it was *given*; a cell left at the terminal's own colour has nothing to
    // shrink and still comes out as the emulator's. The other order asks
    // `downsample` for the nearest palette entry to paper and ink, and at depth
    // zero it hands back `default` again - which is how a picture ends up as
    // one black rectangle.
    const back = cell
      ? colorsOf(reduce(packColor(cell.fg)), reduce(packColor(cell.bg)), cell.attrs, paper, ink).bg
      : paper;

    // Nothing to draw where the cell is the same colour as the backdrop, which
    // is most of most screens.
    if (back === paper) { open = null; continue; }
    if (open && open.fg === back && open.x + open.columns === x) { open.columns += 1; continue; }
    open = { x, columns: 1, text: '', fg: back, attrs: 0, graphic: false };
    runs.push(open);
  }

  return runs;
}

/**
 * Whether a cell is drawn with the drawing characters rather than with letters.
 *
 * The split is where a monospace font stops being certain to have the glyph.
 * Below U+2000 is text - ASCII, Latin, the punctuation any font ships with -
 * and above it is the box drawing, the block elements, the braille the charts
 * are made of, the arrows and the geometric shapes. A font that lacks those
 * substitutes another one for them, and a substitute is under no obligation to
 * use the same advance width, which is the whole reason a run must not span
 * both: `textLength` corrects a run as a unit, so one wrong-width glyph in a
 * run of letters pushes every letter after it off the grid.
 *
 * The `mono` theme is where this shows, because it is where it is worst. Every
 * other theme colours its bars and its borders differently from its text, and
 * a colour change already ends a run - so the split was there by accident.
 * Give a whole screen one colour and each row coalesces into a single run of
 * letters and blocks together, corrected as one.
 */
function isGraphic(char: string): boolean {
  return (char.codePointAt(0) ?? 0x20) >= 0x2000;
}

/** Text runs for one row, coalesced by colour, attributes, and kind. */
function glyphRuns(
  buffer: CellBuffer, y: number, paper: number, ink: number,
  reduce: (c: number) => number,
): Run[] {
  const runs: Run[] = [];
  let open: Run | null = null;

  for (let x = 0; x < buffer.width; x++) {
    const cell = buffer.get(x, y);
    if (cell?.continuation === true) {
      if (open) open.columns += 1;
      continue;
    }
    if (!cell) { open = null; continue; }

    const { fg: front } = colorsOf(
      reduce(packColor(cell.fg)), reduce(packColor(cell.bg)), cell.attrs, paper, ink,
    );
    // `hidden` is a cell whose glyph is not drawn - a masked field. Its
    // background still is, which is why this is here and not in `colorsOf`.
    const char = (cell.attrs & ATTR_HIDDEN) !== 0 ? ' ' : cell.char;
    const graphic = isGraphic(char);
    // Only the attributes that change how a glyph is drawn. `blink` is not one
    // of them: a still frame cannot blink, and an SMIL animation would make
    // the file un-diffable for a flourish nobody asked for.
    const attrs = cell.attrs & (ATTR_BOLD | ATTR_ITALIC | ATTR_UNDERLINE | ATTR_STRIKE);

    if (open && open.fg === front && open.attrs === attrs && open.graphic === graphic
        && open.x + open.columns === x) {
      open.text += char;
      open.columns += 1;
      continue;
    }
    open = { x, columns: 1, text: char, fg: front, attrs, graphic };
    runs.push(open);
  }

  // The row's own trailing blanks. They coalesce onto the last run because
  // they share its colour, and then every row in the file carries spaces out
  // to the right edge - bytes for nothing, and a `textLength` claiming columns
  // the text does not occupy.
  //
  // Only the tail, and only where nothing is drawn through it: a blank in the
  // middle of a row is between two things, and an underlined one is a line.
  const last = runs[runs.length - 1];
  if (last && (last.attrs & (ATTR_UNDERLINE | ATTR_STRIKE)) === 0) {
    const trimmed = last.text.replace(/\s+$/, '');
    last.columns -= last.text.length - trimmed.length;
    last.text = trimmed;
  }

  // A run of blank cells paints nothing - unless it was underlined or struck
  // through, where the line is the whole point.
  return runs.filter((run) => run.text.trim() !== ''
    || (run.attrs & (ATTR_UNDERLINE | ATTR_STRIKE)) !== 0);
}

/**
 * The five XML entities, and no more than that.
 *
 * A frame can hold anything somebody typed, and an unescaped `<` in a filename
 * is the difference between a picture and a file no parser will open.
 */
function escape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
