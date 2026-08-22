import { describe, expect, it } from 'vitest';
import { CLIPBOARD_PATH, registerBuiltins } from '@textui/core';
import type { CommandContext } from '@textui/core';
import { renderApp } from '@textui/testing';
import { registerDocuments } from '../src/index.js';

/**
 * Selection, and what it is for.
 *
 * A selection is not a thing on its own: it exists so that one keystroke can
 * act on more than one character. So every test here ends in an edit, a copy
 * or a key that had to reach past the editor - the highlight is checked once,
 * and everything else is checked by what happened to the buffer.
 */

async function settle(t: { settle(): Promise<void>; flush(): void }, n = 3): Promise<void> {
  for (let i = 0; i < n; i++) { await t.settle(); t.flush(); }
}

async function editing(initial: string, props: Record<string, unknown> = {}) {
  let value = initial;
  const t = await renderApp({
    width: 40, height: 10,
    onBoot: (app) => { registerBuiltins(app); registerDocuments(app); },
    root: {
      component: 'box', direction: 'column', flex: 1,
      children: {
        component: 'CodeEditor', flex: 1, value: initial, lineNumbers: false,
        onChange: { handler: (v: string) => { value = v; } },
        ...props,
      },
    },
  });
  await settle(t);
  t.tab(); t.flush();
  return { t, read: (): string => value };
}

describe('extending a selection', () => {
  it('replaces what is selected when the next key is a character', async () => {
    const { t, read } = await editing('hello\n');
    t.pressAll('shift+right', 'shift+right', 'shift+right', 'shift+right', 'shift+right');
    t.type('!');
    await settle(t);
    expect(read()).toBe('!\n');
    await t.unmount();
  });

  /**
   * The anchor stays where it was dropped and the caret is the end that moves,
   * so shifting back the way you came shrinks the selection. Normalising to a
   * range instead would make it flip, and the character under the caret would
   * change hands halfway through a keypress.
   */
  it('shrinks when the shift key walks back', async () => {
    const { t, read } = await editing('hello\n');
    t.pressAll('shift+right', 'shift+right', 'shift+left');
    t.type('X');
    await settle(t);
    expect(read()).toBe('Xello\n');
    await t.unmount();
  });

  it('drops the selection on a move without shift', async () => {
    const { t, read } = await editing('hello\n');
    t.pressAll('shift+right', 'shift+right', 'right');
    t.type('X');
    await settle(t);
    expect(read()).toBe('helXlo\n');
    await t.unmount();
  });

  it('reaches across lines, newline and all', async () => {
    const { t, read } = await editing('ab\ncd\n');
    t.pressAll('shift+down', 'shift+end');
    t.press('backspace');
    await settle(t);
    expect(read()).toBe('\n');
    await t.unmount();
  });

  it('selects the whole buffer on ctrl+a', async () => {
    const { t, read } = await editing('a\nb\nc\n');
    t.press('ctrl+a');
    t.type('z');
    await settle(t);
    expect(read()).toBe('z');
    await t.unmount();
  });

  it('draws the selection as a background rather than an inversion', async () => {
    const { t } = await editing('abcdef\n');
    t.pressAll('shift+right', 'shift+right', 'shift+right');
    await settle(t);
    const buffer = t.app.buffer();
    const inside = buffer.get(0, 0);
    const outside = buffer.get(4, 0);
    expect(inside?.char).toBe('a');
    expect(outside?.char).toBe('e');
    expect(inside?.bg).not.toEqual(outside?.bg);
    // Still the text's own colour, not a colour picked to be written on.
    expect(inside?.fg).toEqual(outside?.fg);
    await t.unmount();
  });
});

describe('the clipboard', () => {
  it('copies to the store and out to the terminal', async () => {
    const { t } = await editing('hello\n');
    t.press('ctrl+a');
    t.press('ctrl+c');
    await settle(t);
    expect(t.store.get(CLIPBOARD_PATH)).toBe('hello\n');
    expect(t.terminal.clipboardContents()).toBe('hello\n');
    await t.unmount();
  });

  it('cuts what is selected and pastes it back', async () => {
    const { t, read } = await editing('hello world\n');
    t.pressAll('shift+right', 'shift+right', 'shift+right', 'shift+right', 'shift+right');
    t.press('ctrl+x');
    await settle(t);
    expect(read()).toBe(' world\n');

    t.press('end');
    t.press('ctrl+v');
    await settle(t);
    expect(read()).toBe(' worldhello\n');
    await t.unmount();
  });

  it('cuts the whole line when nothing is selected', async () => {
    const { t, read } = await editing('one\ntwo\nthree\n');
    t.press('down');
    t.press('ctrl+x');
    await settle(t);
    expect(read()).toBe('one\nthree\n');
    expect(t.store.get(CLIPBOARD_PATH)).toBe('two\n');
    await t.unmount();
  });

  it('takes a bracketed paste as one edit, not one per character', async () => {
    const { t, read } = await editing('');
    t.paste('one\ntwo\nthree');
    await settle(t);
    expect(read()).toBe('one\ntwo\nthree');

    t.press('ctrl+z');
    await settle(t);
    expect(read(), 'one step back, not three').toBe('');
    await t.unmount();
  });

  it('copies from a readonly buffer but does not cut from one', async () => {
    const { t, read } = await editing('locked\n', { readonly: true });
    t.press('ctrl+a');
    t.press('ctrl+c');
    await settle(t);
    expect(t.store.get(CLIPBOARD_PATH)).toBe('locked\n');

    t.press('ctrl+x');
    await settle(t);
    expect(read()).toBe('locked\n');
    await t.unmount();
  });
});

/**
 * ctrl+c is quit in a terminal application and copy in an editor. Both are
 * right, so the editor takes it only while something is selected - and escape
 * drops a selection, which is what keeps the way out to two keys.
 */
describe('ctrl+c belongs to whoever needs it', () => {
  async function withQuit(initial: string) {
    let quit = 0;
    const t = await renderApp({
      width: 40, height: 10,
      onBoot: (app) => {
        registerBuiltins(app);
        registerDocuments(app);
        app.commands.register({
          id: 'app.quit', title: 'Quit', slots: [],
          run: (_args: Record<string, unknown>, _ctx: CommandContext) => { quit += 1; },
        });
        app.keybindings.register({ keys: 'ctrl+c', commandId: 'app.quit' });
      },
      root: {
        component: 'box', direction: 'column', flex: 1,
        children: { component: 'CodeEditor', flex: 1, value: initial, lineNumbers: false },
      },
    });
    await settle(t);
    t.tab(); t.flush();
    return { t, quits: (): number => quit };
  }

  it('reaches the application when nothing is selected', async () => {
    const { t, quits } = await withQuit('hello\n');
    t.press('ctrl+c');
    await settle(t);
    expect(quits()).toBe(1);
    await t.unmount();
  });

  it('is copy while something is selected', async () => {
    const { t, quits } = await withQuit('hello\n');
    t.pressAll('shift+right', 'shift+right');
    t.press('ctrl+c');
    await settle(t);
    expect(quits()).toBe(0);
    expect(t.store.get(CLIPBOARD_PATH)).toBe('he');
    await t.unmount();
  });

  it('is quit again once escape has dropped the selection', async () => {
    const { t, quits } = await withQuit('hello\n');
    t.pressAll('shift+right', 'shift+right');
    t.press('escape');
    t.press('ctrl+c');
    await settle(t);
    expect(quits()).toBe(1);
    await t.unmount();
  });
});

describe('indenting', () => {
  it('shifts the selected lines, and keeps them selected', async () => {
    const { t, read } = await editing('a\nb\nc\n');
    t.press('ctrl+a');
    t.press('tab');
    await settle(t);
    expect(read()).toBe('  a\n  b\n  c\n');

    // Still selected, so a second press is a second step rather than a
    // reselect.
    t.press('tab');
    await settle(t);
    expect(read()).toBe('    a\n    b\n    c\n');

    t.press('shift+tab');
    await settle(t);
    expect(read()).toBe('  a\n  b\n  c\n');
    await t.unmount();
  });

  it('uses the tab width it was given', async () => {
    const { t, read } = await editing('a\n', { tabWidth: 4 });
    t.pressAll('shift+end');
    t.press('tab');
    await settle(t);
    expect(read()).toBe('    a\n');
    await t.unmount();
  });

  it('leaves a blank line blank rather than trailing whitespace into a diff', async () => {
    const { t, read } = await editing('a\n\nb\n');
    t.press('ctrl+a');
    t.press('tab');
    await settle(t);
    expect(read()).toBe('  a\n\n  b\n');
    await t.unmount();
  });

  it('still lets tab out of the editor when nothing is selected', async () => {
    let value = 'ab\n';
    const t = await renderApp({
      width: 40, height: 8,
      onBoot: (app) => { registerBuiltins(app); registerDocuments(app); },
      root: {
        component: 'box', direction: 'column', flex: 1,
        children: [
          { component: 'CodeEditor', flex: 1, value: 'ab\n', lineNumbers: false,
            onChange: { handler: (v: string) => { value = v; } } },
          { component: 'Button', label: 'elsewhere' },
        ],
      },
    });
    await settle(t);
    t.tab(); t.flush();
    const inside = t.focused()?.id;
    t.tab(); t.flush();
    await settle(t);
    expect(value).toBe('ab\n');
    expect(t.focused()?.id).not.toBe(inside);
    await t.unmount();
  });
});
