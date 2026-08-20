import type { Rect } from '../types/geometry.js';
import type { Style } from '../types/style.js';
import type { ResolvedTheme } from '../types/theme.js';
import type { TerminalCapabilities } from '../types/capabilities.js';
import type { Cell, Color } from '../types/cells.js';
import { ATTR_DIM } from '../types/cells.js';
import type { CellStyle, PaintSurface, RenderContext } from '../types/render.js';
import type { LayoutBox } from '../render/layout.js';
import type { Instance } from './instance.js';
import type { Buffer } from '../render/buffer.js';
import { COLOR_DEFAULT, mix, packColor, type PackedColor } from '../render/color.js';
import { rectIntersect } from '../types/geometry.js';
import { graphemes, graphemeWidth, sanitize, stringWidth, truncate, wrapText } from '../util/text.js';
import {
  attrsFromStyle, NO_INTERACTION, packStyleColor, resolveBorder,
  resolveStyle, type InteractionState, type ResolvedBorder,
} from './style.js';

/**
 * Painting.
 *
 * The tree is walked twice per frame: once to build layout boxes, once to
 * paint them. Both walks skip function components entirely - they contribute
 * their children and nothing else - so the layout engine and the painter only
 * ever see `box`, `text` and `canvas`.
 */

// ------------------------------------------------------------ paint surface

class Surface implements PaintSurface {
  constructor(
    private buffer: Buffer,
    readonly rect: Rect,
    private clipRect: Rect,
  ) {}

  private visible(ax: number, ay: number): boolean {
    return (
      ax >= this.clipRect.x && ax < this.clipRect.x + this.clipRect.width &&
      ay >= this.clipRect.y && ay < this.clipRect.y + this.clipRect.height
    );
  }

  put(x: number, y: number, char: string, style?: CellStyle): void {
    const ax = this.rect.x + x;
    const ay = this.rect.y + y;
    if (!this.visible(ax, ay)) return;
    this.buffer.put(
      ax, ay, char,
      style?.fg === undefined ? COLOR_DEFAULT : packColor(style.fg),
      style?.bg === undefined ? COLOR_DEFAULT : packColor(style.bg),
      style?.attrs ?? 0,
      style?.link,
    );
  }

  text(x: number, y: number, text: string, style?: CellStyle): number {
    let cx = x;
    for (const g of graphemes(sanitize(text))) {
      const w = graphemeWidth(g);
      if (w === 0) continue;
      this.put(cx, y, g, style);
      cx += w;
    }
    return cx - x;
  }

  fill(rect: Rect | undefined, char: string, style?: CellStyle): void {
    const r = rect ?? { x: 0, y: 0, width: this.rect.width, height: this.rect.height };
    for (let y = r.y; y < r.y + r.height; y++) {
      for (let x = r.x; x < r.x + r.width; x++) {
        this.put(x, y, char, style);
      }
    }
  }

  cell(x: number, y: number, cell: Cell): void {
    this.put(x, y, cell.char, {
      fg: cell.fg, bg: cell.bg, attrs: cell.attrs, link: cell.link,
    });
  }

  clip(rect: Rect): PaintSurface {
    const absolute = {
      x: this.rect.x + rect.x,
      y: this.rect.y + rect.y,
      width: rect.width,
      height: rect.height,
    };
    return new Surface(this.buffer, absolute, rectIntersect(this.clipRect, absolute));
  }
}

/** Direct writer for the runtime itself, in absolute buffer coordinates. */
function rawSurface(buffer: Buffer, clip: Rect): PaintSurface {
  return new Surface(buffer, { x: 0, y: 0, width: buffer.width, height: buffer.height }, clip);
}

// ------------------------------------------------------------ render context

export function createRenderContext(
  theme: ResolvedTheme,
  capabilities: TerminalCapabilities,
  state: InteractionState = NO_INTERACTION,
): RenderContext {
  return {
    theme,
    capabilities,
    focused: state.focused,
    hovered: state.hovered,
    active: state.active,
    selected: state.selected,
    disabled: state.disabled,
    color: (c, fallback = 'default') =>
      c === undefined ? fallback : (theme.color(String(c)) as Color),
    glyph: (name) => {
      const g = (theme.glyphs as unknown as Record<string, unknown>)[name];
      return typeof g === 'string' ? g : '';
    },
    measureText: stringWidth,
  };
}

// ------------------------------------------------------------- layout build

export interface PaintEnv {
  theme: ResolvedTheme;
  capabilities: TerminalCapabilities;
  /** Interaction state for an instance, resolved by the runtime. */
  stateOf(instance: Instance): InteractionState;
}

interface HostVisual {
  style: Style;
  border: ResolvedBorder;
  /** Effective colour: this box's own, or the one it inherited. */
  fg: PackedColor;
  bg: PackedColor;
  attrs: number;
  /** True when the background is this box's rather than an ancestor's. */
  ownBg: boolean;
}

/** Colour and attributes handed down to a box's children. */
interface Inherited {
  fg: PackedColor;
  bg: PackedColor;
  attrs: number;
}

const NO_INHERITANCE: Inherited = { fg: COLOR_DEFAULT, bg: COLOR_DEFAULT, attrs: 0 };

const VISUAL = Symbol('textui.visual');

interface VisualBox extends LayoutBox {
  [VISUAL]?: HostVisual;
  instance?: Instance;
}

/**
 * Colour is inherited; a box's own always wins.
 *
 * Without this a `text` inside a coloured box is drawn in the terminal's
 * default colours - and because a cell holds one background, the glyphs punch
 * a hole through the box behind them. That is a label in the wrong colour on a
 * button, a selected row whose text stays the unselected colour, and a filled
 * block with a ragged bar of default background across the middle of it.
 */
function visualFor(
  instance: Instance,
  env: PaintEnv,
  inherited: Inherited = NO_INHERITANCE,
): HostVisual {
  const state = env.stateOf(instance);
  const style = resolveStyle(
    instance.props,
    env.theme,
    instance.component,
    instance.definition?.defaultStyle,
    state,
  );
  const border = resolveBorder(style.border, env.theme);

  const ownFg = packStyleColor(style.fg, env.theme);
  const ownBg = packStyleColor(style.bg, env.theme);

  return {
    style,
    border,
    fg: ownFg === COLOR_DEFAULT ? inherited.fg : ownFg,
    bg: ownBg === COLOR_DEFAULT ? inherited.bg : ownBg,
    // Attributes accumulate: `bold` on a row is bold for what is in the row.
    attrs: attrsFromStyle(style) | inherited.attrs,
    ownBg: ownBg !== COLOR_DEFAULT,
  };
}

/** Boxes contributed by an instance. Function components contribute none. */
export function buildBoxes(
  instance: Instance,
  env: PaintEnv,
  inherited: Inherited = NO_INHERITANCE,
): LayoutBox[] {
  if (instance.kind !== 'host') {
    // A function component contributes no box, and no colour of its own.
    const out: LayoutBox[] = [];
    for (const child of instance.children) out.push(...buildBoxes(child, env, inherited));
    return out;
  }

  const visual = visualFor(instance, env, inherited);
  const box: VisualBox = {
    style: visual.style,
    borderEdges: visual.border.edges,
    children: [],
    rect: { x: 0, y: 0, width: 0, height: 0 },
    content: { x: 0, y: 0, width: 0, height: 0 },
    scrollTop: typeof instance.props.scrollTop === 'number' ? instance.props.scrollTop : 0,
    scrollLeft: typeof instance.props.scrollLeft === 'number' ? instance.props.scrollLeft : 0,
    [VISUAL]: visual,
    instance,
  };

  switch (instance.component) {
    case 'text':
      box.measure = textMeasure(instance, visual.style);
      break;
    case 'canvas': {
      const intrinsic = instance.props.intrinsic as { width?: number; height?: number } | undefined;
      box.measure = () => ({ width: intrinsic?.width ?? 0, height: intrinsic?.height ?? 0 });
      break;
    }
    case 'spacer': {
      const size = typeof instance.props.size === 'number' ? instance.props.size : 0;
      box.measure = () => ({ width: size, height: size });
      break;
    }
    default:
      break;
  }

  const handDown: Inherited = { fg: visual.fg, bg: visual.bg, attrs: visual.attrs };
  for (const child of instance.children) {
    box.children.push(...buildBoxes(child, env, handDown));
  }

  // Painting and hit-testing order within one parent.
  box.children.sort((a, b) => (a.style.zIndex ?? 0) - (b.style.zIndex ?? 0));

  instance.box = box;
  return [box];
}

function textContent(instance: Instance): string {
  const { content, children } = instance.props;
  if (typeof content === 'string') return content;
  if (typeof content === 'number') return String(content);
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (Array.isArray(children)) {
    return children
      .filter((c) => typeof c === 'string' || typeof c === 'number')
      .join('');
  }
  return '';
}

function textMeasure(instance: Instance, style: Style): (w: number, h: number) => { width: number; height: number } {
  return (maxWidth: number) => {
    const text = sanitize(textContent(instance));
    if (text === '') return { width: 0, height: text.includes('\n') ? 1 : 1 };

    const wrap = style.wrap ?? 'none';
    if (wrap === 'none') {
      const lines = text.split('\n');
      return {
        width: Math.max(...lines.map(stringWidth)),
        height: lines.length,
      };
    }
    const limit = Number.isFinite(maxWidth) && maxWidth > 0 ? maxWidth : stringWidth(text);
    const lines = wrapText(text, limit, wrap);
    return {
      width: Math.min(limit, Math.max(0, ...lines.map(stringWidth))),
      height: Math.max(1, lines.length),
    };
  };
}

// ------------------------------------------------------------------- paint

export function paintTree(
  buffer: Buffer,
  instance: Instance,
  env: PaintEnv,
  clip: Rect,
): void {
  if (instance.kind !== 'host') {
    for (const child of instance.children) paintTree(buffer, child, env, clip);
    return;
  }

  const box = instance.box as VisualBox | undefined;
  if (!box) return;

  const visual = box[VISUAL] ?? visualFor(instance, env);
  const rect = box.rect;
  if (rect.width <= 0 || rect.height <= 0) return;

  const own = rectIntersect(clip, rect);
  if (own.width <= 0 || own.height <= 0) {
    // Fully clipped, but absolutely-positioned descendants may still be visible
    // if they escaped - they do not, so nothing to do.
    return;
  }

  const surface = rawSurface(buffer, own);

  // 1. background
  //
  // Only when this box states one: an inherited background has already been
  // painted by whoever owns it, and filling it again per nested box would be
  // the same cells written several times a frame.
  if (visual.ownBg || visual.style.fill) {
    const fill = visual.style.fill ?? ' ';
    for (let y = rect.y; y < rect.y + rect.height; y++) {
      for (let x = rect.x; x < rect.x + rect.width; x++) {
        surface.put(x, y, fill, { bg: colorOf(visual.bg), fg: colorOf(visual.fg) });
      }
    }
  }

  // 2. scrim: recede what is already here, rather than cover it
  if (visual.style.scrim !== undefined && visual.style.scrim !== false) {
    washRegion(
      buffer,
      own,
      packStyleColor(visual.style.scrim === true ? 'scrim' : visual.style.scrim, env.theme),
      visual.style.scrimStrength ?? 0.55,
    );
  }

  // 3. border, with its title and footer
  if (visual.border.style !== 'none') {
    paintBorder(surface, rect, visual, instance, env);
  }

  // 4. content
  switch (instance.component) {
    case 'text':
      paintText(surface, box, visual, instance, env);
      break;
    case 'canvas':
      paintCanvas(buffer, box, instance, env, own);
      break;
    default:
      break;
  }

  // 5. children, clipped to this box's content when overflow is contained
  const childClip =
    visual.style.overflow === 'visible'
      ? clip
      : rectIntersect(clip, box.content);

  for (const child of instance.children) {
    paintTree(buffer, child, env, childClip);
  }
}

/**
 * Blend a region toward one colour.
 *
 * A terminal has no alpha, so the choice is between covering the content
 * behind a modal and moving it toward the scrim colour. Moving it keeps the
 * screen recognisable - you can still see what the dialog is about - and it is
 * what dimming means on a display that cannot dim.
 *
 * A cell left at the terminal's default colour cannot be blended, because we
 * do not know what colour it is; it gets the dim attribute instead.
 */
function washRegion(buffer: Buffer, rect: Rect, color: PackedColor, strength: number): void {
  const amount = Math.max(0, Math.min(1, strength));

  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) {
      const cell = buffer.get(x, y);
      if (!cell) continue;

      const fg = packColor(cell.fg);
      const bg = packColor(cell.bg);
      buffer.put(
        x, y, cell.char,
        fg === COLOR_DEFAULT ? fg : mix(fg, color, amount),
        bg === COLOR_DEFAULT ? bg : mix(bg, color, amount),
        fg === COLOR_DEFAULT || bg === COLOR_DEFAULT ? cell.attrs | ATTR_DIM : cell.attrs,
        cell.link,
      );
    }
  }
}

function colorOf(packed: PackedColor): Color {
  if (packed === COLOR_DEFAULT) return 'default';
  if (packed >= 0x1000000) {
    return { rgb: [(packed >> 16) & 0xff, (packed >> 8) & 0xff, packed & 0xff] };
  }
  return { palette: packed };
}

function paintBorder(
  surface: PaintSurface,
  rect: Rect,
  visual: HostVisual,
  instance: Instance,
  env: PaintEnv,
): void {
  const { chars, sides } = visual.border;
  const fg = visual.border.color !== undefined
    ? colorOf(packStyleColor(visual.border.color, env.theme))
    : colorOf(visual.fg === COLOR_DEFAULT ? packStyleColor('border', env.theme) : visual.fg);
  const bg = colorOf(visual.bg);
  const style: CellStyle = { fg, bg, attrs: visual.attrs };

  const { x, y, width: w, height: h } = rect;
  const right = x + w - 1;
  const bottom = y + h - 1;

  if (sides.top) {
    for (let i = x; i <= right; i++) surface.put(i, y, chars.top, style);
  }
  if (sides.bottom && h > 1) {
    for (let i = x; i <= right; i++) surface.put(i, bottom, chars.bottom, style);
  }
  if (sides.left) {
    for (let i = y; i <= bottom; i++) surface.put(x, i, chars.left, style);
  }
  if (sides.right && w > 1) {
    for (let i = y; i <= bottom; i++) surface.put(right, i, chars.right, style);
  }

  if (sides.top && sides.left) surface.put(x, y, chars.topLeft, style);
  if (sides.top && sides.right && w > 1) surface.put(right, y, chars.topRight, style);
  if (sides.bottom && sides.left && h > 1) surface.put(x, bottom, chars.bottomLeft, style);
  if (sides.bottom && sides.right && w > 1 && h > 1) {
    surface.put(right, bottom, chars.bottomRight, style);
  }

  const inner = w - 2;
  if (inner <= 0) return;

  const title = instance.props.title;
  if (sides.top && typeof title === 'string' && title !== '') {
    paintBorderLabel(
      surface, x, y, inner, ` ${title} `,
      (instance.props.titleAlign as 'left' | 'center' | 'right') ?? 'left',
      { ...style, fg: colorOf(visual.fg === COLOR_DEFAULT ? packStyleColor('text', env.theme) : visual.fg), attrs: visual.attrs },
      env.theme.glyphs.ellipsis,
    );
  }

  const footer = instance.props.footer;
  if (sides.bottom && h > 1 && typeof footer === 'string' && footer !== '') {
    paintBorderLabel(
      surface, x, bottom, inner, ` ${footer} `,
      (instance.props.footerAlign as 'left' | 'center' | 'right') ?? 'left',
      { ...style, fg: colorOf(packStyleColor('muted', env.theme)) },
      env.theme.glyphs.ellipsis,
    );
  }
}

function paintBorderLabel(
  surface: PaintSurface,
  x: number,
  y: number,
  inner: number,
  label: string,
  align: 'left' | 'center' | 'right',
  style: CellStyle,
  ellipsis: string,
): void {
  const text = truncate(sanitize(label), inner, ellipsis);
  const w = stringWidth(text);
  const offset =
    align === 'center' ? Math.max(0, Math.floor((inner - w) / 2))
      : align === 'right' ? Math.max(0, inner - w)
        : 0;
  surface.text(x + 1 + offset, y, text, style);
}

function paintText(
  surface: PaintSurface,
  box: LayoutBox,
  visual: HostVisual,
  instance: Instance,
  env: PaintEnv,
): void {
  const content = sanitize(textContent(instance));
  if (content === '') return;

  const { content: area } = box;
  if (area.width <= 0 || area.height <= 0) return;

  const style: CellStyle = {
    fg: colorOf(visual.fg),
    bg: colorOf(visual.bg),
    attrs: visual.attrs,
    link: typeof instance.props.link === 'string' ? instance.props.link : undefined,
  };

  const wrap = visual.style.wrap ?? 'none';
  const align = visual.style.textAlign ?? 'left';
  const truncateSide = instance.props.truncate as 'end' | 'start' | 'middle' | false | undefined;
  // The ellipsis is a glyph like any other: on an ascii terminal it is '...'.
  const ellipsis = typeof instance.props.ellipsis === 'string'
    ? instance.props.ellipsis
    : env.theme.glyphs.ellipsis;

  const raw = wrap === 'none' ? content.split('\n') : wrapText(content, area.width, wrap);

  for (let i = 0; i < raw.length && i < area.height; i++) {
    let line = raw[i] as string;
    if (stringWidth(line) > area.width) {
      line = truncateSide === false
        ? line
        : truncate(line, area.width, ellipsis, truncateSide ?? 'end');
    }
    const w = stringWidth(line);
    const offset =
      align === 'center' ? Math.max(0, Math.floor((area.width - w) / 2))
        : align === 'right' ? Math.max(0, area.width - w)
          : 0;
    surface.text(area.x + offset, area.y + i, line, style);
  }
}

/**
 * The escape hatch. A canvas draws in its own coordinate space starting at
 * 0,0, clipped to its content box - so a chart can be written without knowing
 * where on screen it landed.
 */
function paintCanvas(
  buffer: Buffer,
  box: LayoutBox,
  instance: Instance,
  env: PaintEnv,
  clip: Rect,
): void {
  const draw = instance.props.draw;
  if (typeof draw !== 'function') return;

  const area = box.content;
  if (area.width <= 0 || area.height <= 0) return;

  const surface = new Surface(buffer, area, rectIntersect(clip, area));
  const ctx = createRenderContext(env.theme, env.capabilities, env.stateOf(instance));
  try {
    (draw as (s: PaintSurface, c: RenderContext) => void)(surface, ctx);
  } catch (err) {
    instance.runtime.onError(err, `canvas draw in <${instance.component}>`);
  }
}
