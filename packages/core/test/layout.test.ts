import { describe, expect, it } from 'vitest';
import { layout, measureBox, resolveEdges, type LayoutBox } from '../src/render/layout.js';
import type { Style } from '../src/types/style.js';
import { ZERO_EDGES } from '../src/types/geometry.js';

function box(style: Style, children: LayoutBox[] = []): LayoutBox {
  return {
    style,
    borderEdges: ZERO_EDGES,
    children,
    rect: { x: 0, y: 0, width: 0, height: 0 },
    content: { x: 0, y: 0, width: 0, height: 0 },
  };
}

function leaf(style: Style, width: number, height: number): LayoutBox {
  return {
    ...box(style),
    measure: () => ({ width, height }),
  };
}

function bordered(style: Style, children: LayoutBox[] = []): LayoutBox {
  return { ...box(style, children), borderEdges: { top: 1, right: 1, bottom: 1, left: 1 } };
}

const VIEWPORT = { x: 0, y: 0, width: 40, height: 10 };

describe('resolveEdges', () => {
  it('accepts a scalar, pairs, triples and quads', () => {
    expect(resolveEdges(2)).toEqual({ top: 2, right: 2, bottom: 2, left: 2 });
    expect(resolveEdges([1, 2])).toEqual({ top: 1, right: 2, bottom: 1, left: 2 });
    expect(resolveEdges([1, 2, 3])).toEqual({ top: 1, right: 2, bottom: 3, left: 2 });
    expect(resolveEdges([1, 2, 3, 4])).toEqual({ top: 1, right: 2, bottom: 3, left: 4 });
    expect(resolveEdges({ left: 3 })).toEqual({ top: 0, right: 0, bottom: 0, left: 3 });
  });
});

describe('column layout', () => {
  it('stacks children and stretches them across', () => {
    const a = leaf({}, 5, 1);
    const b = leaf({}, 5, 2);
    layout(box({ direction: 'column' }, [a, b]), VIEWPORT);

    expect(a.rect).toEqual({ x: 0, y: 0, width: 40, height: 1 });
    expect(b.rect).toEqual({ x: 0, y: 1, width: 40, height: 2 });
  });

  it('inserts the gap between children but not around them', () => {
    const a = leaf({}, 5, 1);
    const b = leaf({}, 5, 1);
    layout(box({ direction: 'column', gap: 2 }, [a, b]), VIEWPORT);
    expect(a.rect.y).toBe(0);
    expect(b.rect.y).toBe(3);
  });

  it('gives all remaining height to a flex child', () => {
    const head = leaf({}, 5, 1);
    const body = box({ flex: 1 });
    const foot = leaf({}, 5, 1);
    layout(box({ direction: 'column' }, [head, body, foot]), VIEWPORT);

    expect(head.rect.height).toBe(1);
    expect(body.rect.height).toBe(8);
    expect(foot.rect.height).toBe(1);
    expect(foot.rect.y).toBe(9);
  });
});

describe('row layout', () => {
  it('places children left to right', () => {
    const a = leaf({}, 4, 1);
    const b = leaf({}, 6, 1);
    layout(box({ direction: 'row' }, [a, b]), VIEWPORT);
    expect(a.rect).toMatchObject({ x: 0, width: 4 });
    expect(b.rect).toMatchObject({ x: 4, width: 6 });
  });

  it('splits free space between equal flex children with no cell lost', () => {
    const a = box({ flex: 1 });
    const b = box({ flex: 1 });
    const c = box({ flex: 1 });
    layout(box({ direction: 'row' }, [a, b, c]), { x: 0, y: 0, width: 10, height: 1 });

    const widths = [a.rect.width, b.rect.width, c.rect.width];
    expect(widths.reduce((x, y) => x + y, 0)).toBe(10);
    expect(widths.sort()).toEqual([3, 3, 4]);
  });

  it('weights flex factors', () => {
    const a = box({ flex: 1 });
    const b = box({ flex: 3 });
    layout(box({ direction: 'row' }, [a, b]), { x: 0, y: 0, width: 20, height: 1 });
    expect(a.rect.width).toBe(5);
    expect(b.rect.width).toBe(15);
  });

  it('resolves a percentage against the container', () => {
    const a = box({ width: '25%' });
    layout(box({ direction: 'row' }, [a]), { x: 0, y: 0, width: 40, height: 3 });
    expect(a.rect.width).toBe(10);
  });

  it('shrinks over-wide children back into the row', () => {
    const a = leaf({}, 30, 1);
    const b = leaf({}, 30, 1);
    layout(box({ direction: 'row' }, [a, b]), { x: 0, y: 0, width: 40, height: 1 });
    expect(a.rect.width + b.rect.width).toBeLessThanOrEqual(40);
  });

  it('never shrinks below minWidth', () => {
    const a = leaf({ minWidth: 18 }, 30, 1);
    const b = leaf({}, 30, 1);
    layout(box({ direction: 'row' }, [a, b]), { x: 0, y: 0, width: 40, height: 1 });
    expect(a.rect.width).toBeGreaterThanOrEqual(18);
  });
});

describe('padding and borders', () => {
  it('padding insets the content box', () => {
    const child = box({ flex: 1 });
    const root = box({ padding: 2 }, [child]);
    layout(root, { x: 0, y: 0, width: 20, height: 10 });

    expect(root.content).toEqual({ x: 2, y: 2, width: 16, height: 6 });
    expect(child.rect).toMatchObject({ x: 2, y: 2, width: 16 });
  });

  it('a border consumes one cell per side', () => {
    const child = box({ flex: 1 });
    const root = bordered({}, [child]);
    layout(root, { x: 0, y: 0, width: 20, height: 10 });

    expect(root.content).toEqual({ x: 1, y: 1, width: 18, height: 8 });
    expect(child.rect).toMatchObject({ x: 1, y: 1, width: 18, height: 8 });
  });

  it('border and padding stack', () => {
    const root = bordered({ padding: 1 }, []);
    layout(root, { x: 0, y: 0, width: 20, height: 10 });
    expect(root.content).toEqual({ x: 2, y: 2, width: 16, height: 6 });
  });
});

describe('alignment', () => {
  it('centres on the cross axis', () => {
    const a = leaf({}, 4, 1);
    layout(box({ direction: 'column', align: 'center' }, [a]), { x: 0, y: 0, width: 10, height: 3 });
    expect(a.rect.x).toBe(3);
    expect(a.rect.width).toBe(4);
  });

  it('aligns to the end on the cross axis', () => {
    const a = leaf({}, 4, 1);
    layout(box({ direction: 'column', align: 'end' }, [a]), { x: 0, y: 0, width: 10, height: 3 });
    expect(a.rect.x).toBe(6);
  });

  it('justifies to the end on the main axis', () => {
    const a = leaf({}, 4, 1);
    layout(box({ direction: 'row', justify: 'end' }, [a]), { x: 0, y: 0, width: 10, height: 1 });
    expect(a.rect.x).toBe(6);
  });

  it('spreads with justify between', () => {
    const a = leaf({}, 2, 1);
    const b = leaf({}, 2, 1);
    layout(box({ direction: 'row', justify: 'between' }, [a, b]), { x: 0, y: 0, width: 10, height: 1 });
    expect(a.rect.x).toBe(0);
    expect(b.rect.x).toBe(8);
  });

  it('alignSelf overrides the container', () => {
    const a = leaf({ alignSelf: 'end' }, 3, 1);
    layout(box({ direction: 'column', align: 'start' }, [a]), { x: 0, y: 0, width: 10, height: 3 });
    expect(a.rect.x).toBe(7);
  });
});

describe('absolute positioning', () => {
  it('positions against the parent content box', () => {
    const overlay = box({ position: 'absolute', top: 2, left: 3, width: 5, height: 2 });
    const root = box({ padding: 1 }, [overlay]);
    layout(root, { x: 0, y: 0, width: 20, height: 10 });
    expect(overlay.rect).toEqual({ x: 4, y: 3, width: 5, height: 2 });
  });

  it('stretches between opposite offsets', () => {
    const scrim = box({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 });
    const root = box({}, [scrim]);
    layout(root, { x: 0, y: 0, width: 20, height: 10 });
    expect(scrim.rect).toEqual({ x: 0, y: 0, width: 20, height: 10 });
  });

  it('anchors to the bottom right', () => {
    const toast = box({ position: 'absolute', bottom: 1, right: 2, width: 6, height: 3 });
    const root = box({}, [toast]);
    layout(root, { x: 0, y: 0, width: 20, height: 10 });
    expect(toast.rect).toEqual({ x: 12, y: 6, width: 6, height: 3 });
  });

  it('does not consume flow space', () => {
    const overlay = box({ position: 'absolute', top: 0, left: 0, width: 5, height: 5 });
    const a = box({ flex: 1 });
    layout(box({ direction: 'column' }, [overlay, a]), { x: 0, y: 0, width: 20, height: 10 });
    expect(a.rect.height).toBe(10);
  });
});

describe('display none', () => {
  it('takes no space at all', () => {
    const hidden = leaf({ display: 'none' }, 10, 3);
    const shown = box({ flex: 1 });
    layout(box({ direction: 'column' }, [hidden, shown]), { x: 0, y: 0, width: 20, height: 10 });
    expect(shown.rect.height).toBe(10);
  });
});

describe('measure', () => {
  it('sums children along the main axis', () => {
    const root = box({ direction: 'column', gap: 1 }, [leaf({}, 5, 2), leaf({}, 7, 3)]);
    expect(measureBox(root, 40, 40)).toEqual({ width: 7, height: 6 });
  });

  it('includes padding and border in the intrinsic size', () => {
    const root = bordered({ padding: 1 }, [leaf({}, 5, 1)]);
    expect(measureBox(root, 40, 40)).toEqual({ width: 9, height: 5 });
  });

  it('honours a fixed size over the intrinsic one', () => {
    const root = box({ width: 12, height: 4 }, [leaf({}, 5, 1)]);
    expect(measureBox(root, 40, 40)).toEqual({ width: 12, height: 4 });
  });
});

describe('overflow', () => {
  it('records how far a scroll container can scroll', () => {
    const root = box({ direction: 'column', overflow: 'scroll' }, [
      leaf({}, 5, 4), leaf({}, 5, 4), leaf({}, 5, 4),
    ]);
    layout(root, { x: 0, y: 0, width: 20, height: 6 });
    expect(root.scrollSize?.height).toBe(12);
  });

  it('does not shrink the children of a scroll container', () => {
    const a = leaf({}, 5, 4);
    const root = box({ direction: 'column', overflow: 'scroll' }, [a, leaf({}, 5, 4)]);
    layout(root, { x: 0, y: 0, width: 20, height: 6 });
    expect(a.rect.height).toBe(4);
  });

  it('shifts children by the scroll offset', () => {
    const a = leaf({}, 5, 4);
    const b = leaf({}, 5, 4);
    const root = box({ direction: 'column', overflow: 'scroll' }, [a, b]);
    root.scrollTop = 3;
    layout(root, { x: 0, y: 0, width: 20, height: 6 });
    expect(a.rect.y).toBe(-3);
    expect(b.rect.y).toBe(1);
  });

  it('clips a column that overflows rather than squeezing every child', () => {
    // Downwards, a rigid child keeps its size and what does not fit is cut:
    // a panel below the fold is readable, a panel with no bottom edge is not.
    const a = leaf({}, 5, 4);
    const b = leaf({}, 5, 4);
    const root = box({ direction: 'column' }, [a, b]);
    layout(root, { x: 0, y: 0, width: 20, height: 6 });

    expect(a.rect.height).toBe(4);
    expect(b.rect.height).toBe(2);
  });

  it('still shrinks a row that overflows, because text truncates sideways', () => {
    const a = leaf({}, 10, 1);
    const root = box({ direction: 'row' }, [a, leaf({}, 10, 1)]);
    layout(root, { x: 0, y: 0, width: 12, height: 3 });
    expect(a.rect.width).toBeLessThan(10);
  });

  it('shrinks a column child that says it may be shrunk', () => {
    const a = leaf({ shrink: 1 }, 5, 4);
    const root = box({ direction: 'column' }, [a, leaf({ shrink: 1 }, 5, 4)]);
    layout(root, { x: 0, y: 0, width: 20, height: 6 });
    expect(a.rect.height).toBeLessThan(4);
  });
});

/**
 * The rules that keep a document from deciding the shape of the screen.
 *
 * Each of these is a bug that showed up as "the panes move when I open a
 * different file", and each is fixed in the engine rather than in the
 * component, because every component that fills a pane had it.
 */
describe('content must not resize its container', () => {
  it('does not let a grown scroll container claim its content size', () => {
    const scroller = box({ direction: 'column', overflow: 'scroll', flex: 1 }, [
      leaf({}, 5, 200),
    ]);
    // Measured on its own it is a viewport of nothing, not two hundred rows.
    expect(measureBox(scroller, 40, 10).height).toBe(0);
  });

  it('still honours a minimum height on a scroll container', () => {
    const scroller = box({ direction: 'column', overflow: 'scroll', flex: 1, minHeight: 3 }, [
      leaf({}, 5, 200),
    ]);
    expect(measureBox(scroller, 40, 10).height).toBe(3);
  });

  it('spends the deficit on the child that asked to grow', () => {
    const header = leaf({}, 10, 1);
    const body = box({ flex: 1 }, [leaf({}, 10, 200)]);
    const status = leaf({}, 10, 1);
    const root = box({ direction: 'column' }, [header, body, status]);

    layout(root, { x: 0, y: 0, width: 20, height: 12 });

    // The fixed rows survive; the elastic one absorbs the loss.
    expect(header.rect.height).toBe(1);
    expect(status.rect.height).toBe(1);
    expect(body.rect.height).toBe(10);
  });

  it('never places a child outside its container', () => {
    const a = box({ flex: 1 }, [leaf({}, 10, 40)]);
    const b = box({ flex: 1 }, [leaf({}, 10, 40)]);
    const root = box({ direction: 'column' }, [a, b]);

    layout(root, { x: 0, y: 0, width: 20, height: 10 });

    expect(a.rect.y + a.rect.height).toBeLessThanOrEqual(10);
    expect(b.rect.y + b.rect.height).toBeLessThanOrEqual(10);
  });

  it('lets a pane declare that it will not shrink', () => {
    const fixed = box({ width: 12, shrink: 0 }, [leaf({}, 12, 1)]);
    const rest = box({ flex: 1 }, [leaf({}, 200, 1)]);
    const root = box({ direction: 'row' }, [fixed, rest]);

    layout(root, { x: 0, y: 0, width: 30, height: 4 });

    expect(fixed.rect.width).toBe(12);
    expect(rest.rect.width).toBe(18);
  });

  it('gives the same geometry whatever the content is', () => {
    const frame = (lines: number): LayoutBox => {
      const viewer = box({ flex: 1, overflow: 'scroll' }, [leaf({}, 60, lines)]);
      const status = leaf({}, 10, 1);
      return box({ direction: 'column' }, [viewer, status]);
    };

    const small = frame(3);
    const large = frame(4000);
    layout(small, { x: 0, y: 0, width: 40, height: 12 });
    layout(large, { x: 0, y: 0, width: 40, height: 12 });

    expect(large.children[0]?.rect).toEqual(small.children[0]?.rect);
    expect(large.children[1]?.rect).toEqual(small.children[1]?.rect);
  });
});

describe('per-axis gap', () => {
  it('uses columnGap between the children of a row', () => {
    const b = leaf({}, 4, 1);
    const root = box({ direction: 'row', gap: 1, columnGap: 3 }, [leaf({}, 4, 1), b]);
    layout(root, { x: 0, y: 0, width: 40, height: 3 });
    expect(b.rect.x).toBe(7);
  });

  it('uses rowGap between the children of a column', () => {
    const b = leaf({}, 4, 1);
    const root = box({ direction: 'column', gap: 1, rowGap: 3 }, [leaf({}, 4, 1), b]);
    layout(root, { x: 0, y: 0, width: 40, height: 10 });
    expect(b.rect.y).toBe(4);
  });

  it('leaves the other axis on the gap shorthand', () => {
    // `columnGap` on a column is the gap between *lines*, so a column that
    // does not wrap must not pick it up as the gap between its children.
    const b = leaf({}, 4, 1);
    const root = box({ direction: 'column', gap: 2, columnGap: 9 }, [leaf({}, 4, 1), b]);
    layout(root, { x: 0, y: 0, width: 40, height: 10 });
    expect(b.rect.y).toBe(3);
  });
});

describe('flexWrap', () => {
  const four = (): LayoutBox[] => [leaf({}, 6, 1), leaf({}, 6, 1), leaf({}, 6, 1), leaf({}, 6, 1)];

  it('starts a new line when the next child does not fit', () => {
    const items = four();
    const root = box({ direction: 'row', flexWrap: 'wrap', columnGap: 1, rowGap: 0 }, items);
    layout(root, { x: 0, y: 0, width: 14, height: 6 });

    // 6 + 1 + 6 = 13 fits in 14; a third would need 20.
    expect(items.map((i) => i.rect.y)).toEqual([0, 0, 1, 1]);
    expect(items.map((i) => i.rect.x)).toEqual([0, 7, 0, 7]);
  });

  it('reads the gap shorthand on both axes, so wrapped lines are spaced too', () => {
    const items = four();
    const root = box({ direction: 'row', flexWrap: 'wrap', gap: 1 }, items);
    layout(root, { x: 0, y: 0, width: 14, height: 6 });
    expect(items.map((i) => i.rect.y)).toEqual([0, 0, 2, 2]);
  });

  it('stacks lines by rowGap, not by the main-axis gap', () => {
    const items = four();
    const root = box({ direction: 'row', flexWrap: 'wrap', columnGap: 1, rowGap: 2 }, items);
    layout(root, { x: 0, y: 0, width: 14, height: 8 });
    expect(items.map((i) => i.rect.y)).toEqual([0, 0, 3, 3]);
  });

  it('measures to the wrapped height, so the parent leaves room for the lines', () => {
    const root = box({ direction: 'row', flexWrap: 'wrap', columnGap: 1, rowGap: 0 }, four());
    expect(measureBox(root, 14, 20)).toEqual({ width: 13, height: 2 });
  });

  it('measures to one line when it is not wrapping', () => {
    const root = box({ direction: 'row', gap: 1 }, four());
    expect(measureBox(root, 14, 20)).toEqual({ width: 27, height: 1 });
  });

  it('gives a child too big for a whole line that line to itself', () => {
    const wide = leaf({}, 30, 1);
    const items = [leaf({}, 6, 1), wide, leaf({}, 6, 1)];
    const root = box({ direction: 'row', flexWrap: 'wrap', columnGap: 1, rowGap: 0 }, items);
    layout(root, { x: 0, y: 0, width: 14, height: 6 });
    expect(items.map((i) => i.rect.y)).toEqual([0, 1, 2]);
  });

  it('records the cross extent as the scroll size, because that is what overflows', () => {
    const root = box(
      { direction: 'row', flexWrap: 'wrap', columnGap: 1, rowGap: 0, overflow: 'scroll' },
      four(),
    );
    layout(root, { x: 0, y: 0, width: 14, height: 1 });
    expect(root.scrollSize?.height).toBe(2);
  });
});

describe('per-axis overflow', () => {
  it('lets overflowY scroll while overflow clips sideways', () => {
    const root = box({ direction: 'column', overflow: 'hidden', overflowY: 'scroll' }, [
      leaf({}, 5, 4), leaf({}, 5, 4), leaf({}, 5, 4),
    ]);
    layout(root, { x: 0, y: 0, width: 20, height: 6 });
    expect(root.scrollSize?.height).toBe(12);
  });

  it('does not treat a sideways scroller as a vertical one', () => {
    const a = leaf({}, 5, 4);
    const root = box({ direction: 'column', overflowX: 'scroll' }, [a, leaf({}, 5, 4)]);
    layout(root, { x: 0, y: 0, width: 20, height: 6 });
    // A column's own axis is vertical, so `overflowX` leaves the clamp on:
    // the second child is cut to fit rather than left hanging below.
    expect(root.scrollSize).toBeUndefined();
  });
});

describe('a fixed size is a promise to the children', () => {
  it('measures children against a stated width, not the room the parent had', () => {
    // The child asks for 20 when it is measured at 20 and 8 when measured at
    // 7 - a paragraph. The box says 7, so the box gets 7 and the child two rows.
    const wrapping: LayoutBox = {
      ...box({}),
      measure: (maxWidth: number) => (maxWidth >= 20 ? { width: 20, height: 1 } : { width: maxWidth, height: 2 }),
    };
    const root = box({ width: 7 }, [wrapping]);
    expect(measureBox(root, 40, 10)).toEqual({ width: 7, height: 2 });
  });

  it('binds them by maxWidth too', () => {
    const wrapping: LayoutBox = {
      ...box({}),
      measure: (maxWidth: number) => (maxWidth >= 20 ? { width: 20, height: 1 } : { width: maxWidth, height: 2 }),
    };
    const root = box({ maxWidth: 7 }, [wrapping]);
    expect(measureBox(root, 40, 10)).toEqual({ width: 7, height: 2 });
  });
});

/**
 * A run of text that reflows: as wide as it is given, as tall as it needs.
 *
 * The height depends on the width, which is the only reason the measure order
 * matters at all. A leaf with a fixed size cannot tell you it was measured
 * against the wrong width.
 */
function paragraph(style: Style, cells: number): LayoutBox {
  return {
    ...box(style),
    measure: (availW: number) => ({
      width: Math.min(cells, availW),
      height: availW > 0 ? Math.ceil(cells / availW) : 0,
    }),
  };
}

describe('measuring a row', () => {
  it('measures a flexible child at the width its siblings leave it', () => {
    // The shape every `Alert`, list row and status line is: something rigid
    // beside something that reflows. 40 cells of text in a 40-cell row is one
    // line *if* it gets all 40 - and it never does, because the icon and the
    // gap are in front of it.
    const icon = leaf({}, 1, 1);
    const text = paragraph({ flex: 1 }, 40);
    const row = box({ direction: 'row', gap: 1 }, [icon, text]);

    // 40 - 1 - 1 = 38, so two rows. Measured against the full 40 it fitted on
    // one, was laid out on two, and the second was drawn outside its parent.
    expect(measureBox(row, 40, 100).height).toBe(2);
  });

  it('agrees with the height the same row is actually laid out to', () => {
    // The property that was broken, stated directly: a box measures itself and
    // then is laid out, and a component that sizes from the measurement only
    // works if the two say the same thing.
    const make = (): LayoutBox => box({ direction: 'row', gap: 1 }, [
      leaf({}, 1, 1),
      paragraph({ flex: 1 }, 40),
    ]);

    const measured = measureBox(make(), 40, 100).height;

    const laid = make();
    layout(laid, { x: 0, y: 0, width: 40, height: measured });
    const text = laid.children[1] as LayoutBox;
    expect(text.rect.height).toBe(measured);
  });

  it('splits what is left between two flexible children', () => {
    const a = paragraph({ flex: 1 }, 20);
    const b = paragraph({ flex: 1 }, 20);
    const row = box({ direction: 'row' }, [a, b]);
    // Ten cells each, so each is two rows of ten - not one row of twenty.
    expect(measureBox(row, 20, 100).height).toBe(2);
  });

  it('leaves a row of rigid children alone', () => {
    const row = box({ direction: 'row', gap: 1 }, [leaf({}, 5, 3), leaf({}, 5, 1)]);
    // Nothing flexes, so nothing is re-measured and the tallest child wins.
    expect(measureBox(row, 40, 100)).toEqual({ width: 11, height: 3 });
  });

  it('leaves a lone flexible child alone', () => {
    const row = box({ direction: 'row' }, [paragraph({ flex: 1 }, 40)]);
    // One child with the whole width really does get the whole width, and
    // re-measuring it would be re-measuring it against the same number.
    expect(measureBox(row, 40, 100).height).toBe(1);
  });
});
