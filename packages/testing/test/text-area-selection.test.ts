import { describe, expect, it } from 'vitest';
import { CLIPBOARD_PATH, h, useState } from '@textui/core';
import { TextArea } from '@textui/widgets';
import { renderApp } from '../src/index.js';

/*
 * Selecting text with the mouse.
 *
 * An application that reports mouse events has taken the terminal's own
 * select-and-copy away, so it has to offer one back: a drag selects, and the
 * release puts what was selected on the system clipboard over OSC 52.
 *
 * The drag half of that only works because the application holds the pointer
 * for whoever took the button down - dispatch is otherwise a hit test, and a
 * selection dragged past the edge of the field is the pointer being somewhere
 * the field is not.
 */
describe('TextArea selection', () => {
  const open = async (value: string, extra: Record<string, unknown> = {}, width = 30) => {
    const t = await renderApp({
      width,
      height: 8,
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

  const clipboard = (t: Awaited<ReturnType<typeof open>>): string =>
    t.app.store.get<string>(CLIPBOARD_PATH) ?? '';

  /**
   * The background colour of a cell, which is what a selection paints.
   *
   * As a string, because a colour is a structure and two cells painted the
   * same colour are not the same object.
   */
  const bgAt = (t: Awaited<ReturnType<typeof open>>, x: number, y = 0): string =>
    JSON.stringify(t.app.buffer().get(x, y)?.bg ?? null);

  it('copies what a drag covered', async () => {
    const t = await open('hello world');
    t.drag([0, 0], [3, 0], [5, 0]);
    await t.settle();

    expect(clipboard(t)).toBe('hello');
    await t.unmount();
  });

  it('copies the same text dragged the other way', async () => {
    const t = await open('hello world');
    t.drag([11, 0], [8, 0], [6, 0]);
    await t.settle();

    expect(clipboard(t)).toBe('world');
    await t.unmount();
  });

  it('keeps going once the pointer leaves the field', async () => {
    const t = await open('hello world');
    // Off the right of the field entirely: without pointer capture the field
    // never hears about this and the selection stops at the last cell inside.
    t.drag([6, 0], [40, 0], [60, 3]);
    await t.settle();

    expect(clipboard(t)).toBe('world');
    await t.unmount();
  });

  it('takes the line break with a selection that spans lines', async () => {
    const t = await open('ab\ncd');
    t.drag([1, 0], [1, 1]);
    await t.settle();

    expect(clipboard(t)).toBe('b\nc');
    await t.unmount();
  });

  it('selects by cells, not characters', async () => {
    const t = await open('日本語ab');
    // Two columns per glyph: this is 日本, not 日本語ab's first four characters.
    t.drag([0, 0], [4, 0]);
    await t.settle();

    expect(clipboard(t)).toBe('日本');
    await t.unmount();
  });

  it('leaves the clipboard alone for a click that selects nothing', async () => {
    const t = await open('hello world');
    t.app.store.set(CLIPBOARD_PATH, 'untouched');
    t.click(3, 0);
    await t.settle();

    expect(clipboard(t)).toBe('untouched');
    await t.unmount();
  });

  it('does not copy when copyOnSelect is off', async () => {
    const t = await open('hello world', { copyOnSelect: false });
    t.drag([0, 0], [5, 0]);
    await t.settle();

    expect(clipboard(t)).toBe('');
    await t.unmount();
  });

  it('paints the selection and nothing either side of it', async () => {
    const t = await open('hello world');
    t.drag([6, 0], [11, 0]);
    await t.settle();

    const inside = bgAt(t, 7);
    expect(inside).not.toBe('null');
    expect(bgAt(t, 6)).toBe(inside);
    expect(bgAt(t, 10)).toBe(inside);
    // The cell before the selection and the empty field beyond it are not it.
    expect(bgAt(t, 5)).not.toBe(inside);
    expect(bgAt(t, 12)).not.toBe(inside);
    await t.unmount();
  });

  it('replaces the selection with what is typed next', async () => {
    const t = await open('hello world');
    t.drag([6, 0], [11, 0]);
    await t.settle();
    t.type('there');
    await t.settle();

    expect(t.line(0)).toBe('hello there');
    await t.unmount();
  });

  it('deletes the selection on backspace, and only the selection', async () => {
    const t = await open('hello world');
    t.drag([5, 0], [11, 0]);
    await t.settle();
    t.press('backspace');
    await t.settle();

    expect(t.line(0)).toBe('hello');
    await t.unmount();
  });

  it('extends with shift and collapses without it', async () => {
    const t = await open('hello world');
    t.click(0, 0);
    await t.settle();
    t.pressAll('shift+right', 'shift+right', 'shift+right');
    await t.settle();
    expect(bgAt(t, 0)).toBe(bgAt(t, 2));

    const selection = bgAt(t, 0);
    t.press('right');
    await t.settle();
    // Collapsed: the first three cells are back to the field's own background.
    expect(bgAt(t, 0)).not.toBe(selection);
    await t.unmount();
  });

  it('collapses to the near edge on a plain arrow', async () => {
    const t = await open('hello world');
    t.drag([6, 0], [11, 0]);
    await t.settle();
    // Left goes to the start of the selection, not one back from where the
    // drag ended.
    t.press('left');
    await t.settle();
    t.type('X');
    await t.settle();

    expect(t.line(0)).toBe('hello Xworld');
    await t.unmount();
  });

  it('scrolls the field when the drag goes past the edge of it', async () => {
    // Six lines in a field three rows tall, and the caret starts at the end -
    // so the field opens on the last three and the first three are off-screen.
    const t = await open('one\ntwo\nthree\nfour\nfive\nsix', { maxRows: 3 });
    expect(t.hasText('one')).toBe(false);

    // From the last row shown, up past the top of the field. Clamping the row
    // to what is on screen would stop this dead at the first visible line.
    t.drag([0, 2], [0, 0], [0, -3]);
    await t.settle();

    expect(clipboard(t)).toBe('one\ntwo\nthree\nfour\nfive\n');
    expect(t.hasText('one')).toBe(true);
    await t.unmount();
  });

  /*
   * Two clicks and three, which a terminal has no notion of.
   *
   * The wire says press and release; "double click" is arithmetic on when the
   * presses arrived and where. Which is why `click` here steps the clock past
   * the window and `clickRepeat` does not - two clicks and one double click
   * are different tests, not a race.
   */
  it('takes the word under a double click', async () => {
    const t = await open('hello brave world');
    t.clickRepeat(8, 0, 2);
    await t.settle();

    expect(clipboard(t)).toBe('brave');
    await t.unmount();
  });

  it('takes the run of spaces when the double click lands between words', async () => {
    const t = await open('hello   world');
    t.clickRepeat(6, 0, 2);
    await t.settle();

    // The gap, not either of the words either side of it.
    expect(clipboard(t)).toBe('   ');
    await t.unmount();
  });

  it('does not run a word across a line break', async () => {
    const t = await open('hello\nworld');
    t.clickRepeat(2, 0, 2);
    await t.settle();

    expect(clipboard(t)).toBe('hello');
    await t.unmount();
  });

  it('takes the whole line on a third click', async () => {
    const t = await open('first line\nsecond line\nthird line');
    t.clickRepeat(3, 1, 3);
    await t.settle();

    // The logical line and its break, not the row it happened to be drawn on.
    expect(clipboard(t)).toBe('second line\n');
    await t.unmount();
  });

  it('takes the wrapped paragraph, not the row under the pointer', async () => {
    // Twelve columns of field: this is one line over three rows.
    const t = await open('aaaa bbbb cccc dddd', {}, 12);
    t.clickRepeat(2, 1, 3);
    await t.settle();

    expect(clipboard(t)).toBe('aaaa bbbb cccc dddd');
    await t.unmount();
  });

  it('starts over when the clicks are apart in time', async () => {
    const t = await open('hello brave world');
    t.click(8, 0);
    t.click(8, 0);
    await t.settle();

    // Two clicks, a second apart: a caret, twice - not a word.
    expect(clipboard(t)).toBe('');
    await t.unmount();
  });

  it('starts over when the second click is somewhere else', async () => {
    const t = await open('hello brave world');
    // Inside the window but on another cell, which is two clicks.
    t.clickRepeat(8, 0, 1);
    t.clickRepeat(2, 0, 1);
    await t.settle();

    expect(clipboard(t)).toBe('');
    await t.unmount();
  });

  it('comes back round to a caret on the fourth', async () => {
    const t = await open('hello brave world');
    t.clickRepeat(8, 0, 4);
    await t.settle();
    t.type('X');
    await t.settle();

    // A caret in the middle of "brave", not a word or a line replaced.
    expect(t.line(0)).toBe('hello brXave world');
    await t.unmount();
  });

  it('copies a selection made with the keyboard, like one made with the mouse', async () => {
    const t = await open('hello world');
    t.click(0, 0);
    await t.settle();
    t.pressAll('shift+right', 'shift+right', 'shift+right', 'shift+right', 'shift+right');
    await t.settle();

    // Highlighted and on the clipboard are the same thing. They were not: a
    // keyboard selection showed and never copied.
    expect(clipboard(t)).toBe('hello');
    await t.unmount();
  });

  describe('a word at a time', () => {
    const caretAfter = async (t: Awaited<ReturnType<typeof open>>, mark: string) => {
      t.type(mark);
      await t.settle();
      return t.line(0);
    };

    it('jumps forward to the start of the next word', async () => {
      const t = await open('hello brave world');
      t.press('home');
      await t.settle();
      t.press('ctrl+right');
      await t.settle();

      // The start of "brave", not the gap in front of it.
      expect(await caretAfter(t, '|')).toBe('hello |brave world');
      await t.unmount();
    });

    it('jumps back to the start of the word it is in', async () => {
      const t = await open('hello brave world');
      t.press('end');
      await t.settle();
      t.pressAll('ctrl+left', 'ctrl+left');
      await t.settle();

      expect(await caretAfter(t, '|')).toBe('hello |brave world');
      await t.unmount();
    });

    it('treats a line break as a step of its own', async () => {
      const t = await open('one two\nthree');
      // The very start. `home` is the start of the *line*, and the caret opens
      // at the end of the value - which is line two.
      t.click(0, 0);
      await t.settle();
      // "two" is two jumps, and the break is a third - so the caret rests at
      // the end of the line before it crosses.
      t.pressAll('ctrl+right', 'ctrl+right');
      await t.settle();
      t.type('|');
      await t.settle();
      expect(t.lines()[0]).toBe('one two|');

      t.press('backspace');
      t.press('ctrl+right');
      await t.settle();
      t.type('|');
      await t.settle();
      expect(t.lines()[1]).toBe('|three');
      await t.unmount();
    });

    it('extends the selection when shift is held, and copies it', async () => {
      const t = await open('hello brave world');
      t.press('home');
      await t.settle();
      t.pressAll('shift+ctrl+right', 'shift+ctrl+right');
      await t.settle();

      expect(clipboard(t)).toBe('hello brave ');
      await t.unmount();
    });
  });

  it('gives escape to the selection before it gives it to onCancel', async () => {
    let cancelled = 0;
    const t = await open('hello world', { onCancel: () => { cancelled += 1; } });
    t.drag([0, 0], [5, 0]);
    await t.settle();

    t.press('escape');
    await t.settle();
    expect(cancelled).toBe(0);

    t.press('escape');
    await t.settle();
    expect(cancelled).toBe(1);
    await t.unmount();
  });
});
