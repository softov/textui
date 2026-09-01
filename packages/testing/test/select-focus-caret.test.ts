import { describe, expect, it } from 'vitest';
import { h, useState } from '@textui/core';
import { Select, TextInput } from '@textui/widgets';
import { renderApp } from '../src/index.js';

/*
 * Where the terminal cursor goes when focus lands on something you cannot
 * type into.
 *
 * A select has no caret, so it published none, and the cursor stayed sitting
 * in the text field somebody had just tabbed out of - which reads as the focus
 * never having moved. It owns the cursor while it is focused instead: there is
 * nothing to type there, but the cursor is the strongest "you are here" a
 * terminal has, and the alternative is a border colour and nothing else.
 */
describe('focus moving between a field and a select', () => {
  const ESC = String.fromCharCode(27);

  const open = async () => {
    const t = await renderApp({
      width: 40,
      height: 6,
      encode: true,
      root: h(function Host() {
        const [text, setText] = useState('abc');
        const [choice, setChoice] = useState('a');
        return h('box', { direction: 'column' },
          h(TextInput, { value: text, onChange: setText, focusId: 'field', autoFocus: true }),
          h(Select, {
            options: [{ value: 'a', label: 'Apple' }, { value: 'b', label: 'Pear' }],
            value: choice, onChange: setChoice,
          }));
      }, {}),
    });
    await t.settle();
    t.focus('field');
    await t.settle();
    return t;
  };

  /** Where this frame leaves the cursor, reading one frame rather than the session. */
  const caret = async (t: Awaited<ReturnType<typeof open>>): Promise<{ shown: boolean; row?: number }> => {
    t.clearOutput();
    t.resize(40, 6);
    await t.settle();
    const out = t.output();
    const places = [...out.matchAll(new RegExp(`${ESC}\\[(\\d+);(\\d+)H`, 'g'))];
    const last = places[places.length - 1];
    return out.includes(`${ESC}[?25h`) && last
      ? { shown: true, row: Number(last[1]) }
      : { shown: false };
  };

  it('puts it in the field while the field has focus', async () => {
    const t = await open();
    const where = await caret(t);
    expect(where.shown).toBe(true);
    await t.unmount();
  });

  it('moves it onto the select rather than leaving it behind', async () => {
    const t = await open();
    const before = await caret(t);
    // Tabbed rather than focused by name: `Select` generates its own focus id
    // and takes no `focusId`, so there is nothing to aim at.
    t.press('tab');
    await t.settle();
    const after = await caret(t);

    expect(after.shown).toBe(true);
    // The regression: this was the field's row, so the focus looked as though
    // it had never left.
    expect(after.row).not.toBe(before.row);
    await t.unmount();
  });
});
