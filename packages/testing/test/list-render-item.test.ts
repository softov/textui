import { describe, expect, it } from 'vitest';
import { h } from '@textui/core';
import { List, Row } from '@textui/widgets';
import type { ListItem, ListItemState } from '@textui/widgets';
import { renderApp } from '../src/index.js';

/**
 * A row the caller draws.
 *
 * The built-in row is one line - icon, title, description, meta - and it is
 * what most catalogues are. The alternative to letting a caller replace it is
 * another field on `ListItem` every time one of them wants something the
 * shape does not have, and a flag beside it saying where to put it. That road
 * ends with a component whose props are a small layout language and which
 * still cannot draw the row after next.
 *
 * So the contents are the caller's and everything a row cannot do for itself
 * stays with the list: the selection, the keys that move it, the window that
 * scrolls, the highlight, the marker column and the click.
 */

const ITEMS: ListItem[] = [
  { id: 'a', label: 'Kqueue events on Linux', description: 'claude  ·  brb_framework', meta: 'waiting on you' },
  { id: 'b', label: 'Split the transcript viewport', description: 'claude  ·  textui', meta: 'running' },
  { id: 'c', label: 'Advisor case 412 triage', description: 'claude  ·  service_advisor', meta: 'error' },
];

/** Title and status on one line, everything that qualifies them on the next. */
const twoLine = (item: ListItem, state: ListItemState) => h('box', { direction: 'column' },
  h(Row, { gap: 1 },
    h('text', { content: item.label, flex: 1, truncate: 'end' }),
    h('text', { content: state.selected ? `${item.meta ?? ''} *` : (item.meta ?? ''), shrink: 0 })),
  h(Row, {}, h('text', { content: item.description ?? '', flex: 1, truncate: 'end' })),
);

describe('a List with renderItem', () => {
  it('draws the caller row instead of the built-in one', async () => {
    const t = await renderApp({
      width: 60,
      height: 8,
      root: h(List, { items: ITEMS, renderItem: twoLine, itemHeight: 2 }),
    });
    await t.settle();

    // The title has the line to itself, and the elaboration is under it
    // rather than beside it - which is the whole reason a caller reaches for
    // this rather than for the built-in row.
    expect(t.line(0)).toContain('Kqueue events on Linux');
    expect(t.line(0)).toContain('waiting on you');
    expect(t.line(0)).not.toContain('brb_framework');
    expect(t.line(1)).toContain('brb_framework');
    await t.unmount();
  });

  it('still draws the marker itself, and still moves the selection', async () => {
    const t = await renderApp({
      width: 60,
      height: 8,
      root: h(List, { items: ITEMS, renderItem: twoLine, itemHeight: 2, autoFocus: true }),
    });
    await t.settle();

    // The marker belongs to the selection rather than to the row: a column
    // every caller has to remember to draw is a column that goes crooked.
    expect(t.line(0).trimStart().startsWith('Kqueue')).toBe(false);
    expect(t.line(0)).toMatch(/^\s*\S\s+Kqueue/);

    await t.press('down');
    await t.settle();
    // Two lines down, not one. The selection is in rows and the frame is in
    // lines, and the marker is the thing that says which is which.
    expect(t.line(2)).toMatch(/^\s*\S\s+Split the transcript viewport/);
    await t.unmount();
  });

  it('tells the row whether the selection is live', async () => {
    const t = await renderApp({
      width: 60,
      height: 8,
      root: h(List, { items: ITEMS, renderItem: twoLine, itemHeight: 2, autoFocus: true }),
    });
    await t.settle();
    // `state.selected` is what the star is drawn from, so this is the row
    // being told which one it is.
    expect(t.line(0)).toContain('waiting on you *');
    expect(t.line(2)).not.toContain('*');
    await t.unmount();
  });

  it('fits half as many rows when each one is two lines', async () => {
    const tall = await renderApp({
      width: 60,
      height: 6,
      root: h(List, { items: ITEMS, flex: 1 }),
    });
    await tall.settle();
    // One line each: all three, and room to spare.
    expect(tall.text()).toContain('Advisor case 412 triage');
    await tall.unmount();

    const short = await renderApp({
      width: 60,
      height: 4,
      root: h(List, { items: ITEMS, renderItem: twoLine, itemHeight: 2, flex: 1 }),
    });
    await short.settle();
    // Four lines is two rows, not four. The list decides how many fit before
    // anything is drawn - which is the only way a thousand rows cost what ten
    // do - so a row taller than a line has to say so.
    expect(short.text()).toContain('Kqueue events on Linux');
    expect(short.text()).toContain('Split the transcript viewport');
    expect(short.text()).not.toContain('Advisor case 412 triage');
    await short.unmount();
  });

  it('leaves the built-in row alone when nothing asks for another', async () => {
    const t = await renderApp({
      width: 80,
      height: 6,
      root: h(List, { items: ITEMS }),
    });
    await t.settle();
    // One line, all four columns. Adding `renderItem` was not allowed to
    // change what every caller that does not pass one already gets.
    expect(t.line(0)).toContain('Kqueue events on Linux');
    expect(t.line(0)).toContain('brb_framework');
    expect(t.line(0)).toContain('waiting on you');
    expect(t.line(1)).toContain('Split the transcript viewport');
    await t.unmount();
  });
});
