import { describe, expect, it } from 'vitest';
import { h } from '@textui/core';
import { List } from '@textui/widgets';
import { renderApp } from '../src/index.js';
import type { Element, Harness } from '../src/index.js';

/**
 * A selection background always arrives with the colour that reads on it.
 *
 * The pair is stated by the theme, in the component's own entry: `selected`
 * carries `onSelected` and `focus` carries the same over it. Neither is on the
 * node any more - a component that fills a state says which state it is in and
 * the theme says what that looks like - so these assert the cells as drawn
 * rather than the props, which is the only place the answer is now.
 *
 * A filled row that inherited its foreground would be a filled row drawn in
 * the terminal's own colours, and a person is free to have set those to the
 * fill's colour.
 */

const ITEMS = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Bravo' },
  { id: 'c', label: 'Charlie' },
];

const selected = (t: Harness): Element | undefined =>
  t.getAllByRole('listitem').find((el) => el.props.selected === true);

/** A painted colour, as the theme stated it. */
function hex(cell: { fg?: unknown; bg?: unknown }): { fg?: string; bg?: string } {
  const one = (value: unknown): string | undefined =>
    value && typeof value === 'object' && 'rgb' in value
      ? `#${(value as { rgb: number[] }).rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`
      : undefined;
  return { fg: one(cell.fg), bg: one(cell.bg) };
}

/** The first cell of an element, which is inside whatever fill it has. */
function paint(t: Harness, el: Element): { fg?: string; bg?: string } {
  const rect = el.rect;
  if (!rect) throw new Error(`no rect for ${el.role ?? el.component}`);
  return hex(t.app.buffer().get(rect.x, rect.y) ?? {});
}

describe('a selection background', () => {
  it('carries `inverted` when the list has the keyboard', async () => {
    const t = await renderApp({
      width: 40,
      height: 6,
      root: h(List, { items: ITEMS, selectedId: 'b', autoFocus: true }),
    });
    await t.settle();

    // `dark`: selected is the bright fill, and `onSelected` is derived from
    // the theme's own `inverted`.
    expect(paint(t, selected(t) as Element)).toEqual({ bg: '#1f6feb', fg: '#0d1117' });
    await t.unmount();
  });

  it('carries `text` when it does not, which is the slash menu and every list beside a field', async () => {
    const t = await renderApp({
      width: 40,
      height: 6,
      root: h(List, { items: ITEMS, selectedId: 'b', focusable: false }),
    });
    await t.settle();

    // The same pair a step down: the current row without the keyboard, in the
    // dimmer fill and the text the theme can guarantee reads on it.
    expect(paint(t, selected(t) as Element)).toEqual({ bg: '#264466', fg: '#e6edf3' });
    await t.unmount();
  });

  it('leaves a row that is not selected without either', async () => {
    const t = await renderApp({
      width: 40,
      height: 6,
      root: h(List, { items: ITEMS, selectedId: 'b', focusable: false }),
    });
    await t.settle();

    const rows = t.getAllByRole('listitem').filter((el) => el.props.selected !== true);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.props.bg).toBeUndefined();
      expect(row.props.fg).toBeUndefined();
    }
    await t.unmount();
  });

  it('states no colour on the node at all, which is what makes it the theme\'s', async () => {
    const t = await renderApp({
      width: 40,
      height: 6,
      root: h(List, { items: ITEMS, selectedId: 'b', autoFocus: true }),
    });
    await t.settle();

    // The row knows what state it is in and nothing about what that looks
    // like. A component that filled this in itself would outrank the theme
    // and the override below would be silently ignored.
    const row = selected(t) as Element;
    expect(row.props.selected).toBe(true);
    expect(row.props.focused).toBe(true);
    expect(row.props.styleAs).toBe('List');
    expect(row.props.bg).toBeUndefined();
    expect(row.props.fg).toBeUndefined();
    await t.unmount();
  });
});
