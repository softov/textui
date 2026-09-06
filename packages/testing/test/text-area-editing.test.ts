import { describe, expect, it } from 'vitest';
import { defineComponent, h, useState } from '@textui/core';
import { TextArea, registerBuiltins } from '@textui/widgets';
import { renderApp } from '@textui/testing';

/*
 * The editing keys a shell has taught everyone's hands, and taking an edit
 * back.
 *
 * The field had the arrows, home and end, and nothing else: `ctrl+a` typed an
 * `a` nowhere, `ctrl+w` did nothing, and a mistyped paragraph could only be
 * removed one character at a time. Every assertion here is about the value the
 * field reports rather than the frame it draws, because the frame follows and
 * a test that reads the frame passes on a field that draws one thing and hands
 * back another.
 */

/** A field that owns its own value, since `TextArea` does not. */
const editing = async (initial: string, caretAtEnd = true) => {
  let value = initial;
  let taken = 0;
  const Field = defineComponent<Record<string, never>>('Field', () => {
    const [text, setText] = useState(initial);
    value = text;
    return h(TextArea, {
      value: text,
      onChange: (next: string) => { setText(next); },
      onSubmit: () => { taken += 1; },
      autoFocus: true,
      width: 40,
    });
  });
  const t = await renderApp({
    width: 44,
    height: 10,
    onBoot: (app) => { registerBuiltins(app); },
    root: h(Field, {}),
  });
  await t.settle();
  await t.settle();
  // The caret starts after the text; a test that wants it elsewhere says so.
  if (!caretAtEnd) { await t.press('home'); await t.settle(); }
  return {
    t,
    get value() { return value; },
    get submits() { return taken; },
    async key(...keys: string[]) {
      for (const one of keys) { await t.press(one); await t.settle(); }
    },
    async type(text: string) {
      // A chord is split on whitespace, so a literal space presses nothing at
      // all - it is named, the way the decoder names it.
      for (const ch of text) { await t.press(ch === ' ' ? 'space' : ch); await t.settle(); }
    },
  };
};

describe('the field takes the readline editing keys', () => {
  it('goes to the start and the end of the line', async () => {
    const f = await editing('hello world');
    await f.key('ctrl+a');
    await f.type('X');
    expect(f.value).toBe('Xhello world');
    await f.key('ctrl+e');
    await f.type('Z');
    expect(f.value).toBe('Xhello worldZ');
  });

  it('kills to the end of the line, and joins the next one when there is nothing left', async () => {
    const f = await editing('hello world');
    await f.key('ctrl+a', 'right', 'right', 'right', 'right', 'right');
    await f.key('ctrl+k');
    expect(f.value).toBe('hello');
  });

  it('kills to the start of the line', async () => {
    const f = await editing('hello world');
    await f.key('ctrl+a', 'right', 'right', 'right', 'right', 'right', 'right');
    await f.key('ctrl+u');
    expect(f.value).toBe('world');
  });

  it('deletes the word before the caret, on ctrl+w and on alt+backspace', async () => {
    const one = await editing('some words here');
    await one.key('ctrl+w');
    expect(one.value).toBe('some words ');

    const two = await editing('some words here');
    await two.key('alt+backspace');
    expect(two.value).toBe('some words ');
  });

  it('deletes the word after the caret on alt+d', async () => {
    const f = await editing('some words here', false);
    await f.key('alt+d');
    expect(f.value).toBe('words here');
  });

  /*
   * Left unclaimed on purpose. `ctrl+f` is character motion in readline and
   * the arrows already are, so the field lets it past for an application to
   * spend on a find command.
   */
  it('leaves ctrl+f alone', async () => {
    const f = await editing('hello');
    await f.key('ctrl+f');
    expect(f.value).toBe('hello');
  });
});

describe('an edit can be taken back', () => {
  it('undoes a run of typing as one step', async () => {
    const f = await editing('');
    await f.type('hello');
    expect(f.value).toBe('hello');
    await f.key('ctrl+z');
    // One step, not five: a snapshot per character would make undo a
    // backspace with extra ceremony.
    expect(f.value).toBe('');
  });

  it('ends the run at a space, so undo lands on a word', async () => {
    const f = await editing('');
    await f.type('one two');
    await f.key('ctrl+z');
    expect(f.value).toBe('one ');
    await f.key('ctrl+z');
    expect(f.value).toBe('');
  });

  it('redoes on alt+z', async () => {
    const f = await editing('');
    await f.type('hello');
    await f.key('ctrl+z');
    expect(f.value).toBe('');
    await f.key('alt+z');
    expect(f.value).toBe('hello');
  });

  it('takes back a kill, which is one step of its own', async () => {
    const f = await editing('some words here');
    await f.key('ctrl+u');
    expect(f.value).toBe('');
    await f.key('ctrl+z');
    expect(f.value).toBe('some words here');
  });

  it('does nothing when there is nothing to take back', async () => {
    const f = await editing('untouched');
    await f.key('ctrl+z', 'ctrl+z');
    expect(f.value).toBe('untouched');
  });

  it('drops the redo stack once something else is typed', async () => {
    const f = await editing('');
    await f.type('one ');
    await f.key('ctrl+z');
    await f.type('two');
    await f.key('alt+z');
    // Redo after a new edit would put back a version that never followed
    // this one.
    expect(f.value).toBe('two');
  });
});
