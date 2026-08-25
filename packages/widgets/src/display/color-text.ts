import type {
  CellStyle, Color, InteractionState, PaintSurface,
  RenderContext, StyleColor, TextProps, TextWrap,
} from '@textui/core';
import {
  attrsFromStyle, defineComponent, flattenStyleInput, graphemeWidth, graphemes, h,
  mergeStyles, mix, packColor, resolveColor, sanitize, stringWidth, styleFromProps,
  truncate, truncateSideOf, unpackColor, useMeasure, wrapModeOf, wrapText,
} from '@textui/core';

/**
 * One cell, as the ink sees it.
 *
 * Both a column and an index, because they are not the same number and which
 * one is wanted depends on the question. `col` is where the cell lands - a
 * wide character advances it by two - so a gradient stays vertical over CJK
 * and emoji. `index` counts graphemes, which is what "the fourth letter"
 * means. Colouring by `index` and painting at `col` is the bug this pair
 * exists to prevent.
 */
export interface InkCell {
  /** The grapheme cluster about to be painted. */
  char: string;
  /** Column within the line, in cells. */
  col: number;
  /** Line index, after wrapping. */
  line: number;
  /** Grapheme index within the line. */
  index: number;
  /** Grapheme index within the whole block. */
  offset: number;
  /** Cells in this line. */
  width: number;
  /** Lines in the block. */
  height: number;
  /** Cells in the widest line of the block. */
  blockWidth: number;
}

/**
 * An ink written as code. Returns a colour, a whole cell style, or nothing.
 *
 * Nothing means "leave this cell to the component's own style", which is what
 * makes an ink that colours one thing - the vowels, the column under the
 * cursor - a two-line function rather than an exhaustive one.
 */
export type InkFn = (cell: InkCell, ctx: RenderContext) => StyleColor | CellStyle | undefined;

/** A ramp between colour stops. */
export interface GradientInk {
  /** Two or more stops. One stop is a flat colour, none is nothing. */
  gradient: StyleColor[];
  /** Across, down, or corner to corner. */
  axis?: 'x' | 'y' | 'xy';
  /**
   * What the ramp is measured against.
   *
   * `block` is the widest line, so every line of a banner shares one ramp and
   * the colours line up down the block. `line` restarts the ramp on each line,
   * which is what a paragraph of ragged lines wants - under `block` a short
   * line would stop halfway through the ramp and look unfinished.
   */
  per?: 'block' | 'line';
}

/**
 * What advances the colour.
 *
 * `cell` counts columns, so bands stay vertical across the lines of a block -
 * the reason it is the default. `grapheme` counts every cluster including
 * spaces, `letter` counts only the ones that print, and `word` and `line`
 * are what they say.
 */
export type InkUnit = 'cell' | 'grapheme' | 'letter' | 'word' | 'line';

/** A palette walked in order and repeated. */
export interface CycleInk {
  cycle: StyleColor[];
  /**
   * How much of the text each colour takes.
   *
   * A number is a fixed run. An array is a repeating pattern of runs, so
   * `[4, 3]` gives four cells of the first colour, three of the second, four
   * of the third, and keeps going in fours and threes.
   */
  every?: number | number[];
  unit?: InkUnit;
  /**
   * Whether the count carries across a line break. Off by default: a run that
   * restarts on every line keeps the bands of a block aligned, and a run that
   * carries over puts them on a diagonal.
   */
  continuous?: boolean;
}

/**
 * How a `ColorText` is coloured.
 *
 * An array is the short spelling of one colour per line. The two object forms
 * are data, so a screen written as JSON can carry them; the function form
 * cannot be serialized and is the escape hatch - the same trade `canvas`
 * makes with `draw`.
 */
export type Ink = StyleColor[] | GradientInk | CycleInk | InkFn;

/**
 * Everything a `text` takes, plus the ink.
 *
 * The same props on purpose: `wrap`, `truncate`, `textAlign` and the style
 * keys all mean here what they mean there, so swapping one for the other is a
 * change of colour and nothing else.
 */
export interface ColorTextProps extends TextProps {
  /** Left unset, this is an ordinary block of text. */
  ink?: Ink;
  /**
   * Align the block as one thing, rather than each line on its own.
   *
   * `textAlign` centres every line over its own middle, which is right for
   * prose and shears a picture: five rows of block letters do not have equal
   * widths once the trailing spaces are gone, so each row lands somewhere
   * slightly different and the letters lean. Under this, the whole block is
   * placed once and the lines keep their offsets from each other.
   *
   * Off by default, because that is what `text` does and the two are supposed
   * to mean the same thing by the same prop.
   */
  alignBlock?: boolean;
}

/**
 * Multiline text coloured cell by cell.
 *
 * A `text` takes one colour for the whole run, which is the right answer for
 * nearly everything and no answer at all for the cases where the colour *is*
 * the content - a banner, a ramp across a title, a palette walked down a
 * block of ascii art. This is that case, and only that case: it is still just
 * text, and the alternative to it is a `text` node.
 *
 * It paints on a `canvas`, and the price of the escape hatch is that inherited
 * colour stops here. A cell the ink declines takes this component's own `fg`
 * rather than the one a parent row would have handed a `text`, so a
 * `ColorText` inside something that recolours its children when selected has
 * to be told about it. Everything an ink does paint is unaffected.
 *
 * ```tsx
 * <ColorText ink={{ gradient: ['cyan', 'magenta'] }}>{banner}</ColorText>
 * <ColorText ink={['danger', 'warning', 'success']}>{lines}</ColorText>
 * <ColorText ink={{ cycle: palette, every: [4, 3] }}>{title}</ColorText>
 * <ColorText ink={(cell) => (cell.line === cell.col ? 'accent' : undefined)}>{grid}</ColorText>
 * ```
 *
 * The colour is decoration and never the message: a 16-colour session flattens
 * a three-stop ramp into a couple of bands, and a piped log loses all of it.
 */
export const ColorText = defineComponent<ColorTextProps>('ColorText', (props) => {
  const { content, children, ink, ellipsis, alignBlock, ...rest } = props;
  const source = sanitize(textOf(content, children));
  const wrap = (props.wrap ?? 'none') as TextWrap;

  // The width layout settled on last frame, for the height this frame asks
  // for. Painting uses the surface's own width instead - that one is current -
  // so the lag here costs a line count and never a wrong line break.
  const measured = useMeasure().width;
  const natural = source.split('\n').reduce((w, line) => Math.max(w, stringWidth(line)), 0);
  const height = linesOf(source, wrap, measured > 0 ? measured : natural).length;

  // A block that does not wrap is as wide as its widest line and says so -
  // that is what a banner is. One that wraps or truncates asks for nothing and
  // takes what it is given, because a paragraph that reported the width of its
  // unbroken text would push every sibling off the row to get it.
  const width = wrap === 'none' ? natural : 0;

  const draw = (surface: PaintSurface, ctx: RenderContext): void => {
    const { width: area, height: rows } = surface.rect;
    if (area <= 0 || rows <= 0 || source === '') return;

    // The component's own style, resolved for the state it is in. Not the
    // inherited one - a canvas is not told what it was nested in.
    const own = mergeStyles(
      styleFromProps(props as Record<string, unknown>),
      flattenStyleInput(props.style, stateOf(ctx)),
    );
    const rest: CellStyle = {
      fg: resolveColor(own.fg, ctx.theme, 'default'),
      attrs: attrsFromStyle(own),
      link: typeof props.link === 'string' ? props.link : undefined,
    };

    const cut = props.truncate ?? truncateSideOf(wrap) ?? 'end';
    const dots = ellipsis ?? ctx.theme.glyphs.ellipsis;
    const lines = linesOf(source, wrap, area).map((line) =>
      (stringWidth(line) > area && cut !== false ? truncate(line, area, dots, cut) : line));

    // After truncating, not before: the width the block is placed by is the
    // width it is going to occupy.
    const blockWidth = lines.reduce((w, line) => Math.max(w, stringWidth(line)), 0);
    const paint = painterOf(ink, ctx);
    const align = own.textAlign ?? 'left';
    const origin = alignBlock ? indentFor(align, area, blockWidth) : undefined;

    let offset = 0;
    for (let y = 0; y < lines.length && y < rows; y++) {
      const line = lines[y] as string;
      const lineWidth = stringWidth(line);
      const indent = origin ?? indentFor(align, area, lineWidth);

      let col = 0;
      let index = 0;
      for (const char of graphemes(line)) {
        const advance = graphemeWidth(char);
        if (advance === 0) continue;
        const style = paint({
          char, col, line: y, index, offset, width: lineWidth, height: lines.length, blockWidth,
        });
        // A space with nothing but a foreground has nothing to show, and
        // painting it would wipe out whatever the box behind it drew there.
        if (char !== ' ' || style?.bg !== undefined || rest.bg !== undefined) {
          surface.put(indent + col, y, char, style ? { ...rest, ...style } : rest);
        }
        col += advance;
        index++;
        offset++;
      }
    }
  };

  return h('canvas', { draw, intrinsic: { width, height }, ...rest });
});

// ------------------------------------------------------------------- inks

/**
 * A colour a fraction of the way along a set of stops.
 *
 * Exported because an ink written by hand wants it and the alternative is
 * unpacking colours in application code. `t` outside 0..1 is clamped rather
 * than extrapolated - a ramp has ends.
 */
export function gradientAt(stops: Color[], t: number): Color {
  if (stops.length === 0) return 'default';
  if (stops.length === 1) return stops[0] as Color;
  const at = Math.min(1, Math.max(0, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(at));
  return blend(stops[i] as Color, stops[i + 1] as Color, at - i);
}

/** Two colours mixed. `t` of 0 is `a`, 1 is `b`. Tokens must be resolved first. */
export function blend(a: Color, b: Color, t: number): Color {
  return unpackColor(mix(packColor(a), packColor(b), Math.min(1, Math.max(0, t))));
}

/**
 * An ink in any of its spellings, as the one function paint uses.
 *
 * Exported so a component that paints its own cells - a chart, a viewer with a
 * heat column - can take an `Ink` and mean the same thing by it.
 */
export function painterOf(
  ink: Ink | undefined,
  ctx: RenderContext,
): (cell: InkCell) => CellStyle | undefined {
  if (ink === undefined) return () => undefined;

  if (typeof ink === 'function') {
    return (cell) => styleOf(ink(cell, ctx), ctx);
  }

  if (Array.isArray(ink)) {
    return painterOf({ cycle: ink, unit: 'line' }, ctx);
  }

  if ('gradient' in ink) {
    const stops = ink.gradient.map((c) => resolveColor(c, ctx.theme, 'default'));
    const axis = ink.axis ?? 'x';
    const per = ink.per ?? 'block';
    return (cell) => {
      const span = per === 'line' ? cell.width : cell.blockWidth;
      // A single column or a single line has no distance to ramp over, and
      // dividing by zero would put every cell at the far end of the ramp.
      const x = span > 1 ? cell.col / (span - 1) : 0;
      const y = cell.height > 1 ? cell.line / (cell.height - 1) : 0;
      const t = axis === 'x' ? x : axis === 'y' ? y : (x + y) / 2;
      return { fg: gradientAt(stops, t) };
    };
  }

  const colors = ink.cycle.map((c) => resolveColor(c, ctx.theme, 'default'));
  if (colors.length === 0) return () => undefined;
  const unit = ink.unit ?? 'cell';
  const runs = (Array.isArray(ink.every) ? ink.every : [ink.every ?? 1])
    .map((n) => Math.max(1, Math.floor(n)));
  const continuous = ink.continuous ?? false;

  // `letter` and `word` are counted rather than derived, because both depend
  // on what came before them on the line and neither can be recovered from a
  // column number. Kept per line so the run restarts where the line does.
  let letters = 0;
  let words = 0;
  let wasBlank = true;
  let at = -1;

  return (cell) => {
    if (cell.line !== at) {
      at = cell.line;
      if (!continuous) { letters = 0; words = 0; }
      wasBlank = true;
    }
    const blank = cell.char.trim() === '';
    if (!blank && wasBlank) words++;
    if (!blank) letters++;
    wasBlank = blank;

    const n = unit === 'cell' ? (continuous ? cell.offset : cell.col)
      : unit === 'grapheme' ? (continuous ? cell.offset : cell.index)
        : unit === 'letter' ? Math.max(0, letters - 1)
          : unit === 'word' ? Math.max(0, words - 1)
            : cell.line;
    return { fg: colors[runIndex(n, runs) % colors.length] as Color };
  };
}

/** Which run of a repeating pattern a count falls in. `[4, 3]` over 8 gives 2. */
function runIndex(n: number, runs: number[]): number {
  const total = runs.reduce((a, b) => a + b, 0);
  const cycles = Math.floor(n / total);
  let rest = n % total;
  let i = 0;
  while (rest >= (runs[i] as number)) { rest -= runs[i] as number; i++; }
  return cycles * runs.length + i;
}

/** A colour, a style, or nothing - as a style, with its tokens resolved. */
function styleOf(
  value: StyleColor | CellStyle | undefined,
  ctx: RenderContext,
): CellStyle | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'string') return { fg: resolveColor(value, ctx.theme, 'default') };
  if ('rgb' in value || 'palette' in value) return { fg: value as Color };
  const style = value as CellStyle;
  return {
    ...style,
    fg: style.fg === undefined ? undefined : resolveColor(style.fg, ctx.theme, 'default'),
    bg: style.bg === undefined ? undefined : resolveColor(style.bg, ctx.theme, 'default'),
  };
}

// ------------------------------------------------------------------ text

function textOf(content: unknown, children: unknown): string {
  if (typeof content === 'string') return content;
  if (typeof content === 'number') return String(content);
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (Array.isArray(children)) {
    return children.filter((c) => typeof c === 'string' || typeof c === 'number').join('');
  }
  return '';
}

/** Where a line of `width` starts, in a box of `area`. */
function indentFor(align: 'left' | 'center' | 'right', area: number, width: number): number {
  if (align === 'center') return Math.max(0, Math.floor((area - width) / 2));
  if (align === 'right') return Math.max(0, area - width);
  return 0;
}

/** The same line-breaking `text` does, so the two agree about where a line ends. */
function linesOf(text: string, wrap: TextWrap, width: number): string[] {
  if (text === '') return [];
  // The truncating modes are one line by definition; a newline inside one has
  // nowhere to go, so it becomes a space rather than silently taking the rest
  // of the text with it.
  if (truncateSideOf(wrap) !== undefined) return [text.replace(/\n/g, ' ')];
  const mode = wrapModeOf(wrap);
  if (mode === 'none' || width <= 0) return text.split('\n');
  return wrapText(text, width, mode);
}

function stateOf(ctx: RenderContext): InteractionState {
  return {
    focused: ctx.focused, hovered: ctx.hovered, active: ctx.active,
    selected: ctx.selected, disabled: ctx.disabled,
  };
}
