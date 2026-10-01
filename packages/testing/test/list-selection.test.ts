import { describe, expect, it } from 'vitest';
import { h } from '@textui/core';
import { List } from '@textui/widgets';
import { renderApp } from '../src/index.js';

/**
 * A selection background always arrives with the colour that reads on it.
 *
 * The pair is `selected` with `onSelected` and `active` with `onActive`, and
 * the theme resolves the on-token from its own `inverted`/`text` unless it
 * states one - so a filled row never falls back to whatever foreground the
 * terminal happens to have, which a person may have set to the fill's colour.
 */

const ITEMS = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Bravo' },
  { id: 'c', label: 'Charlie' },
];

const selected = (t: Awaited<ReturnType<typeof renderApp>>) =>
  t.getAllByRole('listitem').find((el) => el.props.selected === true);

describe('a selection background', () => {
  it('carries `inverted` when the list has the keyboard', async () => {
    const t = await renderApp({
      width: 40,
      height: 6,
      root: h(List, { items: ITEMS, selectedId: 'b', autoFocus: true }),
    });
    await t.settle();

    const row = selected(t);
    expect(row?.props.bg).toBe('selected');
    expect(row?.props.fg).toBe('onSelected');
    await t.unmount();
  });

  it('carries `text` when it does not, which is the slash menu and every list beside a field', async () => {
    const t = await renderApp({
      width: 40,
      height: 6,
      root: h(List, { items: ITEMS, selectedId: 'b', focusable: false }),
    });
    await t.settle();

    const row = selected(t);
    expect(row?.props.bg).toBe('active');
    expect(row?.props.fg).toBe('onActive');
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
});
