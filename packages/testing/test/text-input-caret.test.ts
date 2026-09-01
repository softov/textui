import { describe, expect, it } from 'vitest';
import { h, useState } from '@textui/core';
import { TextInput } from '@textui/widgets';
import { renderApp } from '../src/index.js';

/*
 * An empty field is where the caret sits at column 0, and column 0 is a column.
 *
 * `cursorPosition` guarded with `!cursor`, so a control publishing a caret at
 * the very start of itself published nothing at all: the terminal cursor
 * stayed hidden until the first character was typed. Every empty input in
 * every application was affected, and what was left marking the focused
 * control was its border colour - easy to miss on a form where every field has
 * a border already.
 *
 * Read one frame at a time. `output()` accumulates every byte since the last
 * `clearOutput`, so asking whether the cursor was ever shown answers about the
 * whole session and not about now - which is how the first version of this
 * test passed against the bug it was written for.
 */
describe('the caret in a text input', () => {
  const ESC = String.fromCharCode(27);

  const open = async (value: string, focused = true) => {
    const t = await renderApp({
      width: 30,
      height: 3,
      encode: true,
      root: h(function Host() {
        const [text, setText] = useState(value);
        return h(TextInput, {
          value: text, onChange: setText,
          focusId: 'f', autoFocus: focused,
        });
      }, {}),
    });
    await t.settle();
    if (focused) t.focus('f');
    await t.settle();
    return t;
  };

  /** Redraw from scratch and report where this frame leaves the cursor. */
  const caretIn = async (t: Awaited<ReturnType<typeof open>>): Promise<{ shown: boolean; column?: number }> => {
    t.clearOutput();
    // A full repaint, so what comes back describes this frame rather than
    // whatever the last keystroke happened to touch.
    t.resize(30, 3);
    await t.settle();
    const out = t.output();
    // Built from `ESC` rather than written as an escape, because a control
    // character in a regular expression literal is a lint error.
    const places = [...out.matchAll(new RegExp(`${ESC}\\[(\\d+);(\\d+)H`, 'g'))];
    const last = places[places.length - 1];
    return out.includes(`${ESC}[?25h`) && last
      ? { shown: true, column: Number(last[2]) }
      : { shown: false };
  };

  // Inside the border and one cell of padding, so the value starts here and so
  // does the caret when there is nothing in front of it.
  const START = 3;

  it('shows where typing will land in an empty field', async () => {
    const t = await open('');
    // The regression: nothing was published, so a focused empty field looked
    // exactly like an unfocused one.
    expect(await caretIn(t)).toEqual({ shown: true, column: START });
    await t.unmount();
  });

  it('shows it at the start of a field that already has content', async () => {
    const t = await open('abc');
    t.press('home');
    await t.settle();
    // The same column 0, reached the other way.
    expect(await caretIn(t)).toEqual({ shown: true, column: START });
    await t.unmount();
  });

  it('puts it past the text when there is text before it', async () => {
    const t = await open('abc');
    expect(await caretIn(t)).toEqual({ shown: true, column: START + 3 });
    await t.unmount();
  });

  it('shows none when nothing is focused', async () => {
    const t = await open('abc', false);
    expect((await caretIn(t)).shown).toBe(false);
    await t.unmount();
  });
});
