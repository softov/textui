import type { Edges, EdgeSpec, Rect, Size } from '../types/geometry.js';
import type { Align, Dimension, Justify, Style } from '../types/style.js';
import { ZERO_EDGES } from '../types/geometry.js';

/**
 * Layout is a flexbox subset sized in whole cells.
 *
 * The subset is deliberate: one line per container (no wrapping), grow and
 * shrink along the main axis, stretch or align on the cross axis, and absolute
 * positioning for layers. Everything a terminal UI actually needs fits in
 * that, and leaving out the rest keeps a pass over a full screen cheap enough
 * to run on every frame.
 *
 * Sizes are integers throughout. A "half cell" does not exist, so fractions
 * are distributed by largest-remainder rather than rounded independently -
 * three flex-1 children of a 10-cell row get 4, 3, 3, never 3, 3, 3 with a
 * gap left over.
 */

export interface LayoutBox {
  style: Style;
  /** Border thickness actually drawn, per side. Consumes content space. */
  borderEdges: Edges;
  children: LayoutBox[];
  /** Intrinsic size for leaves. Containers derive theirs from children. */
  measure?(maxWidth: number, maxHeight: number): Size;
  /** Scroll offset, in cells. Only meaningful with `overflow: 'scroll'`. */
  scrollTop?: number;
  scrollLeft?: number;

  // --- computed by `layout` ---
  rect: Rect;
  /** Inside border and padding. Where children and paint go. */
  content: Rect;
  /** Content larger than `content`, when overflow is 'scroll'. */
  scrollSize?: Size;
}

export function resolveEdges(spec: EdgeSpec | undefined): Edges {
  if (spec === undefined) return ZERO_EDGES;
  if (typeof spec === 'number') {
    return { top: spec, right: spec, bottom: spec, left: spec };
  }
  if (Array.isArray(spec)) {
    if (spec.length === 2) {
      const [v, h] = spec;
      return { top: v, right: h, bottom: v, left: h };
    }
    if (spec.length === 3) {
      const [t, h, b] = spec;
      return { top: t, right: h, bottom: b, left: h };
    }
    const [t, r, b, l] = spec;
    return { top: t, right: r, bottom: b, left: l };
  }
  return {
    top: spec.top ?? 0,
    right: spec.right ?? 0,
    bottom: spec.bottom ?? 0,
    left: spec.left ?? 0,
  };
}

function edgeH(e: Edges): number {
  return e.left + e.right;
}

function edgeV(e: Edges): number {
  return e.top + e.bottom;
}

/** Resolve a dimension against an available extent. `auto` returns null. */
function resolveDimension(dim: Dimension | undefined, available: number): number | null {
  if (dim === undefined || dim === 'auto') return null;
  if (typeof dim === 'number') return Math.max(0, Math.round(dim));
  const pct = Number.parseFloat(dim);
  if (Number.isNaN(pct)) return null;
  return Math.max(0, Math.round((available * pct) / 100));
}

function clamp(v: number, min: number | undefined, max: number | undefined): number {
  let out = v;
  if (min !== undefined) out = Math.max(out, min);
  if (max !== undefined) out = Math.min(out, max);
  return Math.max(0, out);
}

function isColumn(box: LayoutBox): boolean {
  return (box.style.direction ?? 'column') === 'column';
}

function isAbsolute(box: LayoutBox): boolean {
  return box.style.position === 'absolute';
}

function isHidden(box: LayoutBox): boolean {
  return box.style.display === 'none';
}

/** Space this box consumes outside its content: margin, border, padding. */
function frameOf(box: LayoutBox): { margin: Edges; inset: Edges } {
  const margin = resolveEdges(box.style.margin);
  const padding = resolveEdges(box.style.padding);
  const b = box.borderEdges;
  return {
    margin,
    inset: {
      top: b.top + padding.top,
      right: b.right + padding.right,
      bottom: b.bottom + padding.bottom,
      left: b.left + padding.left,
    },
  };
}

/**
 * Intrinsic size, ignoring grow. Containers ask their children; leaves are
 * asked directly. `available` bounds text wrapping, so a paragraph measures
 * against the width it will actually get.
 */
export function measureBox(box: LayoutBox, availW: number, availH: number): Size {
  if (isHidden(box)) return { width: 0, height: 0 };

  const { margin, inset } = frameOf(box);
  const innerAvailW = Math.max(0, availW - edgeH(margin) - edgeH(inset));
  const innerAvailH = Math.max(0, availH - edgeV(margin) - edgeV(inset));

  const fixedW = resolveDimension(box.style.width, availW);
  const fixedH = resolveDimension(box.style.height, availH);

  let contentW = 0;
  let contentH = 0;

  if (fixedW !== null && fixedH !== null) {
    contentW = Math.max(0, fixedW - edgeH(inset));
    contentH = Math.max(0, fixedH - edgeV(inset));
  } else if (box.measure) {
    const m = box.measure(
      fixedW !== null ? Math.max(0, fixedW - edgeH(inset)) : innerAvailW,
      fixedH !== null ? Math.max(0, fixedH - edgeV(inset)) : innerAvailH,
    );
    contentW = fixedW !== null ? Math.max(0, fixedW - edgeH(inset)) : m.width;
    contentH = fixedH !== null ? Math.max(0, fixedH - edgeV(inset)) : m.height;
  } else {
    const flow = box.children.filter((c) => !isAbsolute(c) && !isHidden(c));
    const gap = box.style.gap ?? 0;
    const column = isColumn(box);

    let main = 0;
    let cross = 0;
    let count = 0;
    for (const child of flow) {
      const m = measureBox(child, innerAvailW, innerAvailH);
      const cm = resolveEdges(child.style.margin);
      const childMain = column ? m.height + edgeV(cm) : m.width + edgeH(cm);
      const childCross = column ? m.width + edgeH(cm) : m.height + edgeV(cm);
      main += childMain;
      cross = Math.max(cross, childCross);
      count++;
    }
    if (count > 1) main += gap * (count - 1);

    contentW = column ? cross : main;
    contentH = column ? main : cross;

    // A scroll container that will be grown into place is a viewport, not a
    // bag: what is inside it scrolls, so letting that content set its
    // intrinsic size makes every sibling move when the document changes -
    // which is what a file viewer does to a pane it shares. Grow decides its
    // size; `minHeight`/`minWidth` still set the floor, via `clamp` below.
    if (box.style.overflow === 'scroll' && (box.style.flex ?? 0) > 0) {
      if (column) contentH = 0;
      else contentW = 0;
    }

    if (fixedW !== null) contentW = Math.max(0, fixedW - edgeH(inset));
    if (fixedH !== null) contentH = Math.max(0, fixedH - edgeV(inset));
  }

  const width = clamp(contentW + edgeH(inset), box.style.minWidth, box.style.maxWidth);
  const height = clamp(contentH + edgeV(inset), box.style.minHeight, box.style.maxHeight);
  return { width, height };
}

/**
 * Distribute `total` cells across weights, largest remainder first, so the
 * parts sum to exactly `total` with no cell lost to rounding.
 */
function distribute(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0 || total <= 0) return weights.map(() => 0);

  const exact = weights.map((w) => (total * w) / sum);
  const floors = exact.map(Math.floor);
  let used = floors.reduce((a, b) => a + b, 0);

  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);

  let k = 0;
  while (used < total && order.length > 0) {
    const entry = order[k % order.length] as { i: number; frac: number };
    floors[entry.i] = (floors[entry.i] as number) + 1;
    used++;
    k++;
  }
  return floors;
}

/**
 * Distribute a shrink deficit across weights.
 *
 * Deliberately not `distribute`: largest-remainder gives the leftover cells to
 * the largest *fractions*, which are the small children, so a 200-row pane
 * next to a one-row status bar rounds the status bar out of existence. Here
 * the leftovers go to the largest weights instead - the pane that is too big
 * pays for the rounding, which is the only answer that keeps chrome on screen.
 */
function distributeCuts(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0 || total <= 0) return weights.map(() => 0);

  const cuts = weights.map((w) => Math.floor((total * w) / sum));
  const used = cuts.reduce((a, b) => a + b, 0);

  // Every leftover cell goes to the heaviest child, not one each: spreading
  // them is what costs a one-cell row its only cell.
  let heaviest = 0;
  for (let i = 1; i < weights.length; i++) {
    if ((weights[i] as number) > (weights[heaviest] as number)) heaviest = i;
  }
  cuts[heaviest] = (cuts[heaviest] as number) + (total - used);
  return cuts;
}

function alignOffset(align: Align, free: number): number {
  if (free <= 0) return 0;
  switch (align) {
    case 'center': return Math.floor(free / 2);
    case 'end': return free;
    default: return 0;
  }
}

interface JustifySpacing {
  leading: number;
  between: number;
}

function justifySpacing(justify: Justify, free: number, count: number): JustifySpacing {
  if (free <= 0 || count === 0) return { leading: 0, between: 0 };
  switch (justify) {
    case 'center': return { leading: Math.floor(free / 2), between: 0 };
    case 'end': return { leading: free, between: 0 };
    case 'between':
      return count > 1
        ? { leading: 0, between: Math.floor(free / (count - 1)) }
        : { leading: 0, between: 0 };
    case 'around': {
      const each = Math.floor(free / count);
      return { leading: Math.floor(each / 2), between: each };
    }
    case 'evenly': {
      const each = Math.floor(free / (count + 1));
      return { leading: each, between: each };
    }
    default:
      return { leading: 0, between: 0 };
  }
}

/** Lay a tree out into `viewport`. Mutates `rect` and `content` in place. */
export function layout(root: LayoutBox, viewport: Rect): void {
  layoutBox(root, viewport);
}

function layoutBox(box: LayoutBox, rect: Rect): void {
  const { inset } = frameOf(box);
  box.rect = {
    x: rect.x,
    y: rect.y,
    width: Math.max(0, rect.width),
    height: Math.max(0, rect.height),
  };
  box.content = {
    x: box.rect.x + inset.left,
    y: box.rect.y + inset.top,
    width: Math.max(0, box.rect.width - edgeH(inset)),
    height: Math.max(0, box.rect.height - edgeV(inset)),
  };

  if (isHidden(box)) {
    box.rect = { ...box.rect, width: 0, height: 0 };
    return;
  }

  const flow = box.children.filter((c) => !isAbsolute(c) && !isHidden(c));
  const absolute = box.children.filter((c) => isAbsolute(c) && !isHidden(c));

  if (flow.length > 0) layoutFlow(box, flow);
  for (const child of absolute) layoutAbsolute(box, child);
}

function layoutFlow(box: LayoutBox, flow: LayoutBox[]): void {
  const column = isColumn(box);
  const gap = box.style.gap ?? 0;
  const content = box.content;

  const mainAvail = column ? content.height : content.width;
  const crossAvail = column ? content.width : content.height;
  const gapTotal = flow.length > 1 ? gap * (flow.length - 1) : 0;

  // 1. base sizes
  const margins = flow.map((c) => resolveEdges(c.style.margin));
  const bases: number[] = [];
  for (let i = 0; i < flow.length; i++) {
    const child = flow[i] as LayoutBox;
    const m = margins[i] as Edges;
    const marginMain = column ? edgeV(m) : edgeH(m);

    const basis = child.style.basis ?? (column ? child.style.height : child.style.width);
    const fixed = resolveDimension(basis, mainAvail);
    if (fixed !== null) {
      bases.push(fixed + marginMain);
      continue;
    }

    const measured = measureBox(
      child,
      column ? crossAvail : Math.max(0, mainAvail - gapTotal),
      column ? Math.max(0, mainAvail - gapTotal) : crossAvail,
    );
    bases.push((column ? measured.height : measured.width) + marginMain);
  }

  // 2. grow or shrink into the space that is actually there
  //
  // A scroll container is the exception: shrinking its children to fit is
  // exactly what it must not do, because then there is nothing to scroll.
  const scrolling = box.style.overflow === 'scroll';
  const used = bases.reduce((a, b) => a + b, 0) + gapTotal;
  let free = scrolling ? Math.max(0, mainAvail - used) : mainAvail - used;
  const sizes = bases.slice();

  if (free > 0) {
    const grows = flow.map((c) => Math.max(0, c.style.flex ?? 0));
    if (grows.some((g) => g > 0)) {
      const extra = distribute(free, grows);
      for (let i = 0; i < sizes.length; i++) {
        sizes[i] = (sizes[i] as number) + (extra[i] as number);
      }
      free = 0;
    }
  } else if (free < 0) {
    // Shrink proportionally to size * shrink factor, never below minWidth.
    const deficit = -free;
    //
    // Who gives way, and how a terminal should degrade when it cannot fit
    // everything:
    //
    // A child that asked to grow gives way first. `flex` means elastic, and
    // treating it as rigid is what makes a long document push a header and a
    // status bar out of the frame - they are the fixed-size rows, so they are
    // the ones the deficit would land on.
    //
    // After that the axis decides. Sideways, a rigid child shrinks and its
    // text truncates, which is how terminals have always narrowed. Downwards,
    // it does not: a panel with half a border and no bottom edge is unreadable
    // in a way that a panel below the fold is not, so the overflow is clipped
    // instead (see the clamp below). Either way an explicit `shrink` wins.
    const rigidShrink = column ? 0 : 1;
    const weights = flow.map((c, i) => {
      const shrink = c.style.shrink
        ?? (c.style.flex !== undefined ? Math.max(1, c.style.flex) : rigidShrink);
      return Math.max(0, shrink) * (bases[i] as number);
    });
    if (weights.some((w) => w > 0)) {
      const cuts = distributeCuts(deficit, weights);
      for (let i = 0; i < sizes.length; i++) {
        const child = flow[i] as LayoutBox;
        const min = column ? child.style.minHeight : child.style.minWidth;
        const next = (sizes[i] as number) - (cuts[i] as number);
        sizes[i] = Math.max(min ?? 0, next);
      }
    }
    free = mainAvail - (sizes.reduce((a, b) => a + b, 0) + gapTotal);
  }

  // Whatever is left over after growing and shrinking, nothing may be placed
  // outside the container. A terminal clips at the edge, so a child that keeps
  // its oversized rect is not "overflowing" in any useful sense - it is a
  // child that measures itself wrong, and a component that sizes itself from
  // that measurement never converges. Cells run out in painting order: earlier
  // children keep their size, later ones get what remains.
  if (!scrolling) {
    let room = mainAvail;
    for (let i = 0; i < sizes.length; i++) {
      if (i > 0) room -= gap;
      const size = sizes[i] as number;
      if (size > room) sizes[i] = Math.max(0, room);
      room -= sizes[i] as number;
    }
    free = Math.max(0, room);
  }

  // 3. place
  const spacing = justifySpacing(box.style.justify ?? 'start', Math.max(0, free), flow.length);
  const scrollOffset = scrolling ? (column ? box.scrollTop ?? 0 : box.scrollLeft ?? 0) : 0;
  const origin = (column ? content.y : content.x) + spacing.leading;
  let cursor = origin - scrollOffset;

  for (let i = 0; i < flow.length; i++) {
    const child = flow[i] as LayoutBox;
    const m = margins[i] as Edges;
    const mainSize = Math.max(0, (sizes[i] as number) - (column ? edgeV(m) : edgeH(m)));

    const align = child.style.alignSelf ?? box.style.align ?? 'stretch';
    const crossMargin = column ? edgeH(m) : edgeV(m);
    const crossRoom = Math.max(0, crossAvail - crossMargin);

    let crossSize: number;
    const crossDim = column ? child.style.width : child.style.height;
    const fixedCross = resolveDimension(crossDim, crossAvail);
    if (fixedCross !== null) {
      crossSize = fixedCross;
    } else if (align === 'stretch') {
      crossSize = crossRoom;
    } else {
      const measured = measureBox(
        child,
        column ? crossRoom : mainSize,
        column ? mainSize : crossRoom,
      );
      crossSize = column ? measured.width : measured.height;
    }
    crossSize = clamp(
      crossSize,
      column ? child.style.minWidth : child.style.minHeight,
      column ? child.style.maxWidth : child.style.maxHeight,
    );
    crossSize = Math.min(crossSize, crossRoom);

    const crossStart =
      (column ? content.x + m.left : content.y + m.top) +
      alignOffset(align === 'stretch' ? 'start' : align, crossRoom - crossSize);

    const mainStart = cursor + (column ? m.top : m.left);

    layoutBox(
      child,
      column
        ? { x: crossStart, y: mainStart, width: crossSize, height: mainSize }
        : { x: mainStart, y: crossStart, width: mainSize, height: crossSize },
    );

    cursor += (sizes[i] as number) + gap + (i < flow.length - 1 ? spacing.between : 0);
  }

  // 4. record overflow, so a scroll container knows how far it can go
  const contentExtent = cursor + scrollOffset - origin - gap;
  if (contentExtent > mainAvail) {
    box.scrollSize = column
      ? { width: content.width, height: contentExtent }
      : { width: contentExtent, height: content.height };
  } else {
    box.scrollSize = undefined;
  }
}

/**
 * Absolute children position against the parent's content box. Opposite
 * offsets both set means "stretch between them", which is how a full-bleed
 * scrim or a bottom-anchored bar is written.
 */
function layoutAbsolute(parent: LayoutBox, child: LayoutBox): void {
  const box = parent.content;
  const s = child.style;

  const measured = measureBox(child, box.width, box.height);

  let width = resolveDimension(s.width, box.width) ?? measured.width;
  let height = resolveDimension(s.height, box.height) ?? measured.height;

  let x: number;
  if (s.left !== undefined && s.right !== undefined) {
    x = box.x + s.left;
    width = Math.max(0, box.width - s.left - s.right);
  } else if (s.right !== undefined) {
    x = box.x + box.width - s.right - width;
  } else {
    x = box.x + (s.left ?? 0);
  }

  let y: number;
  if (s.top !== undefined && s.bottom !== undefined) {
    y = box.y + s.top;
    height = Math.max(0, box.height - s.top - s.bottom);
  } else if (s.bottom !== undefined) {
    y = box.y + box.height - s.bottom - height;
  } else {
    y = box.y + (s.top ?? 0);
  }

  width = clamp(width, s.minWidth, s.maxWidth);
  height = clamp(height, s.minHeight, s.maxHeight);

  layoutBox(child, { x, y, width, height });
}
