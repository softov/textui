import type { Rect, Size } from './geometry.js';
import type { Cell, Color } from './cells.js';
import type { Attrs } from './cells.js';
import type { Style } from './style.js';
import type { ResolvedTheme } from './theme.js';
import type { TerminalCapabilities } from './capabilities.js';
import type { ComponentNode } from './graph.js';

/** What a host component paints onto. Clipped to the node's own rect. */
export interface PaintSurface {
  readonly rect: Rect;
  /** Write a grapheme at a content-relative cell. Out of bounds is a no-op. */
  put(x: number, y: number, char: string, style?: CellStyle): void;
  /** Write a string, advancing by grapheme width. Returns cells consumed. */
  text(x: number, y: number, text: string, style?: CellStyle): number;
  fill(rect: Rect | undefined, char: string, style?: CellStyle): void;
  /** Direct cell write, for painters that already resolved everything. */
  cell(x: number, y: number, cell: Cell): void;
  /** A sub-surface, clipped and offset. */
  clip(rect: Rect): PaintSurface;
}

export interface CellStyle {
  fg?: Color;
  bg?: Color;
  attrs?: Attrs;
  link?: string;
}

/** Everything a host needs that is not its props. */
export interface RenderContext {
  theme: ResolvedTheme;
  capabilities: TerminalCapabilities;
  /** Interaction state, already resolved for this instance. */
  focused: boolean;
  hovered: boolean;
  active: boolean;
  selected: boolean;
  disabled: boolean;
  /** Resolve a style token or literal to a concrete colour. */
  color(c: unknown, fallback?: Color): Color;
  /** Glyph for a role, downgraded to ascii when the terminal demands it. */
  glyph(name: string): string;
  /** Measure a string in terminal cells, honouring wide and zero-width. */
  measureText(text: string): number;
}

export interface MeasureConstraints {
  /** Infinity means "as much as you want". */
  maxWidth: number;
  maxHeight: number;
  minWidth: number;
  minHeight: number;
}

/**
 * A host component is a primitive that participates in layout and paint
 * directly. There are deliberately few of them - Box, Text and Canvas - and
 * the entire catalog is function components composing those, so the layout
 * engine only ever reasons about three shapes.
 */
export interface HostComponent<P = Record<string, unknown>> {
  name: string;
  /** Style contributed by props, merged under the node's own `style` prop. */
  style?(props: P, ctx: RenderContext): Style | undefined;
  /** Intrinsic size when the style does not fix one. */
  measure?(props: P, ctx: RenderContext, constraints: MeasureConstraints): Size;
  /** Paint the content box. Border and background are painted by the runtime. */
  paint?(surface: PaintSurface, props: P, ctx: RenderContext): void;
  /** True when this host lays out children (Box). */
  container?: boolean;
  /** Never receives children; a children prop is a programmer error. */
  leaf?: boolean;
}

export type FunctionComponent<P = any> = (props: P) => RenderOutput;

export type RenderOutput =
  | ComponentNode
  | ComponentNode[]
  | string
  | number
  | null
  | undefined
  | false
  | RenderOutput[];
