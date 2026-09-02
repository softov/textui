import { describe, expect, it } from 'vitest';
import { h, useState } from '@textui/core';
import type { MouseEvent } from '@textui/core';
import { Column } from '@textui/widgets';
import { renderApp } from '../src/index.js';

/*
 * What a drag costs, which is not what a keystroke costs.
 *
 * A terminal reports every cell the pointer crosses and delivers them in
 * whatever batches the read gave it, so a gesture across the screen is a
 * stream of events of which only the last position means anything. Rendering
 * per event lays out and paints the whole tree once per report - free on a
 * short screen, and on a long transcript the thing being dragged crawling
 * along seconds behind the pointer.
 */

describe('a drag over a large tree', () => {
  /** Something that repaints when carried, in a tree big enough to cost. */
  const carried = () => h(function Carried() {
    const [at, move] = useState(0);
    return h('text', {
      content: `x${String(at)}`,
      onMouse: (event: MouseEvent) => {
        if (event.action === 'down') { move(event.x); return true; }
        if (event.action === 'drag') { move(event.x); return true; }
        return false;
      },
    });
  }, {});

  const open = async () => {
    const t = await renderApp({
      width: 40,
      height: 10,
      root: h(
        Column,
        { flex: 1 },
        carried(),
        ...Array.from({ length: 200 }, (_, i) => h('text', { key: i, content: `row ${String(i)}` })),
      ),
    });
    for (let i = 0; i < 4; i++) await t.settle();
    return t;
  };

  it('coalesces the motion instead of drawing a frame per report', async () => {
    const t = await open();
    const before = t.app.stats().renders;

    const path: [number, number][] = Array.from({ length: 40 }, (_, i) => [i, 0]);
    t.drag([0, 0], ...path);
    await t.settle();

    // The press, the release and the frame the motion asked for - not one
    // for each of the forty cells the pointer crossed.
    expect(t.app.stats().renders - before).toBeLessThan(10);
    await t.unmount();
  });

  /** And it still arrives: coalesced is not dropped. */
  it('draws where the pointer ended up', async () => {
    const t = await open();
    t.drag([0, 0], [9, 0], [21, 0], [33, 0]);
    await t.settle();
    expect(t.hasText('x33')).toBe(true);
    await t.unmount();
  });
});
