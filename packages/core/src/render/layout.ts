import type { Edges, EdgeSpec, Rect, Size } from '../types/geometry.js';
import type { Align, Dimension, Justify, Overflow, Style } from '../types/style.js';
import { ZERO_EDGES } from '../types/geometry.js';

/**
 * Layout is a flexbox subset sized in whole cells.
 *
 * The subset is deliberate: grow and shrink along the main axis, stretch or
 * align on the cross axis, optional wrapping into further lines, and absolute
 * positioning for layers. Everything a terminal UI actually needs fits in
 * that, and leaving out the rest keeps a pass over a full screen cheap enough
 * to run on every frame.
 *
 * Wrapping is off by default, and that is a performance decision as much as a
 * design one: a non-wrapping container measures each child once, and a
 * wrapping one has to measure them all before it knows where the first line
 * ends.
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

  /**
   * The last answer `measureBox` gave for this box, and what it was asked.
   *
   * Sizing a flex container measures its children to find their intrinsic
   * size, then measures them again against the space they were given - so a
   * frame asks the same subtree the same question about twice, and the deeper
   * the tree the more of it is repeated work. Counted on a 400-row list: 866
   * calls, 407 of them distinct.
   *
   * One slot, not a map: the repeats are adjacent, and a map per box is an
   * allocation per box to avoid an allocation per box. No invalidation either,
   * because layout boxes are rebuilt from the instance tree every frame - the
   * cache cannot outlive the thing it describes.
   */
  measured?: { w: number; h: number; size: Size };
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

function isWrapping(box: LayoutBox): boolean {
  return box.style.flexWrap === 'wrap';
}

/**
 * `overflow` for one axis. The specific prop wins over the shorthand, so
 * `overflow: 'hidden', overflowY: 'scroll'` is a pane that scrolls down and
 * clips sideways - which is what a log viewer is.
 */
export function overflowOn(style: Style, axis: 'x' | 'y'): Overflow {
  return (axis === 'x' ? style.overflowX : style.overflowY) ?? style.overflow ?? 'visible';
}

/** The overflow governing this container's own main axis. */
function mainOverflow(box: LayoutBox): Overflow {
  return overflowOn(box.style, isColumn(box) ? 'y' : 'x');
}

/**
 * Gaps, resolved to this container's axes.
 *
 * `columnGap` and `rowGap` are named for the screen, not for the container:
 * `columnGap` is always the horizontal one. So on a row it is the gap between
 * children and on a column it is the gap between wrapped lines, and a style
 * that sets both reads the same either way round.
 */
function gapsOf(box: LayoutBox): { main: number; cross: number } {
  const vertical = box.style.rowGap ?? box.style.gap ?? 0;
  const horizontal = box.style.columnGap ?? box.style.gap ?? 0;
  return isColumn(box)
    ? { main: vertical, cross: horizontal }
    : { main: horizontal, cross: vertical };
}

/**
 * Cut a run of main-axis sizes into lines that each fit `limit`.
 *
 * A child bigger than the whole line still gets a line to itself rather than
 * an empty one pushed in front of it: it is going to overflow either way, and
 * a blank row above it helps nobody.
 */
function splitLines(mains: number[], gap: number, limit: number): [number, number][] {
  const lines: [number, number][] = [];
  let start = 0;
  let used = 0;

  for (let i = 0; i < mains.length; i++) {
    const size = mains[i] as number;
    const next = used === 0 ? size : used + gap + size;
    if (used > 0 && next > limit) {
      lines.push([start, i]);
      start = i;
      used = size;
      continue;
    }
    used = next;
  }
  lines.push([start, mains.length]);
  return lines;
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

  const seen = box.measured;
  if (seen !== undefined && seen.w === availW && seen.h === availH) return seen.size;

  const { margin, inset } = frameOf(box);

  const fixedW = resolveDimension(box.style.width, availW);
  const fixedH = resolveDimension(box.style.height, availH);

  // What the children get to measure against.
  //
  // A stated width is a promise to the children, not just to the parent: a
  // paragraph inside `width: 7` wraps at seven cells, and measuring it against
  // whatever room the *parent* had leaves it one row tall with half of it
  // unpainted. `maxWidth` binds the same way - it is the width the content
  // will end up with, so it is the width the content should be measured at.
  const boundW = Math.min(fixedW ?? availW - edgeH(margin), box.style.maxWidth ?? Infinity);
  const boundH = Math.min(fixedH ?? availH - edgeV(margin), box.style.maxHeight ?? Infinity);
  const innerAvailW = Math.max(0, boundW - edgeH(inset));
  const innerAvailH = Math.max(0, boundH - edgeV(inset));

  let contentW = 0;
  let contentH = 0;

  if (fixedW !== null && fixedH !== null) {
    contentW = Math.max(0, fixedW - edgeH(inset));
    contentH = Math.max(0, fixedH - edgeV(inset));
  } else if (box.measure) {
    const m = box.measure(innerAvailW, innerAvailH);
    contentW = fixedW !== null ? Math.max(0, fixedW - edgeH(inset)) : m.width;
    contentH = fixedH !== null ? Math.max(0, fixedH - edgeV(inset)) : m.height;
  } else {
    const gaps = gapsOf(box);
    const column = isColumn(box);

    // Skipped in the loop rather than filtered into an array first: measuring
    // is the hot recursive walk of the whole tree, and this is one throwaway
    // array per box per measure. `count` is what `flow.length` used to say.
    let count = 0;
    const mains: number[] = [];
    const crosses: number[] = [];
    for (const child of box.children) {
      if (isAbsolute(child) || isHidden(child)) continue;
      count++;
      const m = measureBox(child, innerAvailW, innerAvailH);
      const cm = resolveEdges(child.style.margin);
      mains.push(column ? m.height + edgeV(cm) : m.width + edgeH(cm));
      crosses.push(column ? m.width + edgeH(cm) : m.height + edgeV(cm));
    }

    // What a flexible child in a row will *actually* be given.
    //
    // Every child above was measured against the full inner width, which is
    // only the width it gets when it is the only one there. In a row beside a
    // rigid sibling it will be narrower - and a child whose height depends on
    // its width, which is any wrapping text, then reports a height for a width
    // it never has. `Alert` is `row(icon, column(flex: 1)(text wrap: 'word'))`,
    // so a message one cell too long to fit measured as one row, was laid out
    // two rows tall, and lost its last word off the bottom.
    //
    // `room` is what the flexible children share: the width left after the
    // rigid ones and the gaps. That is their final size whichever way the
    // distribution went - if there was space over they grow into all of it, and
    // if there was not they are the ones that give way first (see `layoutLine`)
    // - so it is the width to measure their height at.
    //
    // Rows only. The mirror case in a column would be a child whose *width*
    // depends on its height, and nothing measures that way round.
    if (!column && count > 1) {
      let totalFlex = 0;
      let rigidMain = 0;
      let index = 0;
      for (const child of box.children) {
        if (isAbsolute(child) || isHidden(child)) continue;
        const flex = Math.max(0, child.style.flex ?? 0);
        if (flex > 0) totalFlex += flex;
        else rigidMain += mains[index] as number;
        index++;
      }

      if (totalFlex > 0) {
        const room = Math.max(0, innerAvailW - rigidMain - gaps.main * (count - 1));
        index = 0;
        for (const child of box.children) {
          if (isAbsolute(child) || isHidden(child)) continue;
          const flex = Math.max(0, child.style.flex ?? 0);
          if (flex > 0) {
            const cm = resolveEdges(child.style.margin);
            const share = Math.max(0, Math.floor((room * flex) / totalFlex) - edgeH(cm));
            const m = measureBox(child, share, innerAvailH);
            crosses[index] = m.height + edgeV(cm);
          }
          index++;
        }
      }
    }

    let main = 0;
    let cross = 0;
    if (isWrapping(box) && count > 1) {
      // Wrapping trades one axis for the other: the main extent is whatever
      // the widest line came to - never more than the room it was given - and
      // the cross extent grows by a line at a time. Measuring it any other way
      // makes the parent size this box as though it were still one long line,
      // and then it wraps inside a box too short to hold what it wrapped into.
      const limit = column ? innerAvailH : innerAvailW;
      const lines = splitLines(mains, gaps.main, limit);
      for (const [from, to] of lines) {
        let lineMain = 0;
        let lineCross = 0;
        for (let i = from; i < to; i++) {
          lineMain += (mains[i] as number) + (i > from ? gaps.main : 0);
          lineCross = Math.max(lineCross, crosses[i] as number);
        }
        main = Math.max(main, lineMain);
        cross += lineCross;
      }
      if (lines.length > 1) cross += gaps.cross * (lines.length - 1);
    } else {
      for (let i = 0; i < mains.length; i++) {
        main += mains[i] as number;
        cross = Math.max(cross, crosses[i] as number);
      }
      if (mains.length > 1) main += gaps.main * (mains.length - 1);
    }

    contentW = column ? cross : main;
    contentH = column ? main : cross;

    // A scroll container that will be grown into place is a viewport, not a
    // bag: what is inside it scrolls, so letting that content set its
    // intrinsic size makes every sibling move when the document changes -
    // which is what a file viewer does to a pane it shares. Grow decides its
    // size; `minHeight`/`minWidth` still set the floor, via `clamp` below.
    if (mainOverflow(box) === 'scroll' && (box.style.flex ?? 0) > 0) {
      if (column) contentH = 0;
      else contentW = 0;
    }

    if (fixedW !== null) contentW = Math.max(0, fixedW - edgeH(inset));
    if (fixedH !== null) contentH = Math.max(0, fixedH - edgeV(inset));
  }

  const width = clamp(contentW + edgeH(inset), box.style.minWidth, box.style.maxWidth);
  const height = clamp(contentH + edgeV(inset), box.style.minHeight, box.style.maxHeight);
  const size = { width, height };
  box.measured = { w: availW, h: availH, size };
  return size;
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
  if (!isWrapping(box) || flow.length < 2) {
    const column = isColumn(box);
    const mainAvail = column ? box.content.height : box.content.width;
    const scrolling = mainOverflow(box) === 'scroll';
    const extent = layoutLine(
      box, flow, box.content,
      scrolling ? (column ? box.scrollTop ?? 0 : box.scrollLeft ?? 0) : 0,
    );
    box.scrollSize = extent > mainAvail
      ? (column
          ? { width: box.content.width, height: extent }
          : { width: extent, height: box.content.height })
      : undefined;
    return;
  }
  layoutWrapped(box, flow);
}

/**
 * Wrapping: cut the children into lines, then lay each line out on its own.
 *
 * Each line is a flow in its own right - it grows, shrinks, justifies and
 * aligns exactly as an unwrapped container does - which is why this is a loop
 * around `layoutLine` rather than a second layout algorithm. The lines
 * themselves stack along the cross axis at their natural heights.
 *
 * A wrapping container overflows across, not along: the main axis is the one
 * it just fitted everything into. So its scroll offset and its recorded
 * `scrollSize` are both the cross axis here, which is what a wrapping row
 * inside a ScrollView needs to scroll down through its lines.
 */
function layoutWrapped(box: LayoutBox, flow: LayoutBox[]): void {
  const column = isColumn(box);
  const content = box.content;
  const gaps = gapsOf(box);
  const mainAvail = column ? content.height : content.width;
  const crossAvail = column ? content.width : content.height;

  const mains: number[] = [];
  const crosses: number[] = [];
  for (const child of flow) {
    const margin = resolveEdges(child.style.margin);
    const basis = child.style.basis ?? (column ? child.style.height : child.style.width);
    const fixed = resolveDimension(basis, mainAvail);
    const m = measureBox(
      child,
      column ? crossAvail : mainAvail,
      column ? mainAvail : crossAvail,
    );
    mains.push((fixed ?? (column ? m.height : m.width)) + (column ? edgeV(margin) : edgeH(margin)));
    crosses.push((column ? m.width + edgeH(margin) : m.height + edgeV(margin)));
  }

  const lines = splitLines(mains, gaps.main, mainAvail);
  const scrolling = overflowOn(box.style, column ? 'x' : 'y') === 'scroll';
  const offset = scrolling ? (column ? box.scrollLeft ?? 0 : box.scrollTop ?? 0) : 0;
  const origin = column ? content.x : content.y;
  let cursor = origin - offset;

  for (const [from, to] of lines) {
    let lineCross = 0;
    for (let i = from; i < to; i++) lineCross = Math.max(lineCross, crosses[i] as number);

    layoutLine(
      box,
      flow.slice(from, to),
      column
        ? { x: cursor, y: content.y, width: lineCross, height: content.height }
        : { x: content.x, y: cursor, width: content.width, height: lineCross },
      0,
    );
    cursor += lineCross + gaps.cross;
  }

  const extent = cursor + offset - origin - gaps.cross;
  box.scrollSize = extent > crossAvail
    ? (column
        ? { width: extent, height: content.height }
        : { width: content.width, height: extent })
    : undefined;
}

/**
 * One line of a flow, laid out into `region`.
 *
 * Returns the main-axis extent the children actually came to, which is what
 * tells the caller whether there is anything to scroll.
 */
function layoutLine(
  box: LayoutBox,
  flow: LayoutBox[],
  content: Rect,
  scrollOffset: number,
): number {
  const column = isColumn(box);
  const gap = gapsOf(box).main;

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
  const scrolling = mainOverflow(box) === 'scroll';
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

  // 4. hand back the extent, so the caller knows how far it can scroll
  return cursor + scrollOffset - origin - gap;
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
