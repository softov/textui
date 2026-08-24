import { describe, expect, it } from 'vitest';
import { ATTR_INVERSE, ATTR_UNDERLINE, h, useState } from '@textui/core';
import { TextArea } from '@textui/widgets';
import { renderApp } from '../src/index.js';

/*
 * The caret used to be a glyph inserted between the text before it and the
 * text after, so everything to its right sat one column off from where it
 * would be once the caret moved on - and the row was a cell wider than its own
 * text, which on a wrapped row is the cell that does not fit.
 *
 * It marks the cell it is on instead. There is nothing to see in a text dump,
 * which is the point: the assertions below read the buffer's attributes.
 */
describe('the TextArea caret', () => {
  const open = async (
    value: string,
    extra: Record<string, unknown> = {},
    width = 30,
  ) => {
    const t = await renderApp({
      width,
      height: 6,
      root: h(function Host() {
        const [text, setText] = useState(value);
        return h(TextArea, {
          value: text, onChange: setText, blink: false,
          focusId: 'f', autoFocus: true, ...extra,
        });
      }, {}),
    });
    await t.settle();
    t.focus('f');
    await t.settle();
    return t;
  };

  const attrsAt = (t: Awaited<ReturnType<typeof open>>, x: number, y = 0): number =>
    t.app.buffer().get(x, y)?.attrs ?? 0;

  // Two widths: the whole caret-on-a-wrapped-row question only exists because
  // the field is as wide as the layout made it.
  for (const width of [30, 46]) {
    it(`does not push the text along at ${width} columns`, async () => {
      const t = await open('abcdef', {}, width);
      t.press('home');
      await t.settle();

      // The old glyph made this '▏abcdef'.
      expect(t.line(0)).toBe('abcdef');
      await t.unmount();
    });
  }

  it('underlines the character it is on, and only that one', async () => {
    const t = await open('abcdef');
    t.press('home');
    await t.settle();

    expect(t.app.buffer().get(0, 0)?.char).toBe('a');
    expect(attrsAt(t, 0) & ATTR_UNDERLINE).not.toBe(0);
    for (const x of [1, 2, 3, 4, 5]) expect(attrsAt(t, x) & ATTR_UNDERLINE).toBe(0);
    await t.unmount();
  });

  it('travels with the caret rather than staying put', async () => {
    const t = await open('abcdef');
    t.press('home');
    t.press('right');
    t.press('right');
    await t.settle();

    expect(t.line(0)).toBe('abcdef');
    expect(attrsAt(t, 2) & ATTR_UNDERLINE).not.toBe(0);
    expect(attrsAt(t, 0) & ATTR_UNDERLINE).toBe(0);
    await t.unmount();
  });

  it('fills the cell when asked for a block', async () => {
    const t = await open('abcdef', { caretStyle: 'block' });
    t.press('home');
    await t.settle();

    expect(t.line(0)).toBe('abcdef');
    expect(attrsAt(t, 0) & ATTR_INVERSE).not.toBe(0);
    expect(attrsAt(t, 0) & ATTR_UNDERLINE).toBe(0);
    await t.unmount();
  });

  it('marks a row of the wrap, and moves between them', async () => {
    // The caret is a row and a column, and the row is a visual one. One
    // logical line, two rows, and `up` moves between them rather than out of
    // the field.
    const t = await open('the quick brown fox jumps over the lazy dog');
    expect(t.line(0)).toBe('the quick brown fox jumps');
    expect(t.line(1)).toBe('over the lazy dog');

    // The caret starts past the last character, on the second row.
    const end = 'over the lazy dog'.length;
    expect(attrsAt(t, end, 1) & ATTR_UNDERLINE).not.toBe(0);

    t.press('up');
    await t.settle();

    // Same column, the row above - and the text has not moved.
    expect(attrsAt(t, end, 0) & ATTR_UNDERLINE).not.toBe(0);
    expect(attrsAt(t, end, 1) & ATTR_UNDERLINE).toBe(0);
    expect(t.line(0)).toBe('the quick brown fox jumps');
    await t.unmount();
  });

  it('sits on the placeholder rather than in front of it', async () => {
    // A caret that pushed the placeholder along moved the one piece of text in
    // an empty field every time it was focused.
    const t = await open('', { placeholder: 'say something' });
    expect(t.line(0)).toBe('say something');
    expect(attrsAt(t, 0) & ATTR_UNDERLINE).not.toBe(0);
    expect(attrsAt(t, 1) & ATTR_UNDERLINE).toBe(0);
    await t.unmount();
  });
});
