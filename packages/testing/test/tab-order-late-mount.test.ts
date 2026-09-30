import { describe, expect, it } from 'vitest';
import { h, useState } from '@textui/core';
import { TextInput } from '@textui/widgets';
import { renderApp } from '../src/index.js';

/*
 * A field that appears after the form opened is tabbed to where it is drawn.
 *
 * Tab order was registration order, so a field a choice revealed - a model's
 * thinking level, shown once a model is picked - went to the end of the list,
 * after the button that submits the form.
 */
describe('tab order of a field mounted late', () => {
  it('follows the tree, not the order the fields arrived in', async () => {
    let reveal = (): void => {};
    const t = await renderApp({
      width: 40,
      height: 6,
      root: h(function Host() {
        const [shown, setShown] = useState(false);
        reveal = () => setShown(true);
        const field = (id: string) => h(TextInput, { key: id, value: '', onChange: () => {}, focusId: id });
        return h('box', { direction: 'column' },
          field('first'),
          ...(shown ? [field('middle')] : []),
          field('last'));
      }, {}),
    });
    await t.settle();
    reveal();
    await t.settle();

    t.focus('first');
    await t.settle();
    t.press('tab');
    await t.settle();
    expect(t.app.focus.focused()).toBe('middle');
    t.press('tab');
    await t.settle();
    expect(t.app.focus.focused()).toBe('last');
    await t.unmount();
  });
});
