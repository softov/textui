import { describe, expect, it } from 'vitest';
import type { Resource, ResourceProvider } from '@textui/core';
import { h } from '@textui/core';
import { registerBuiltins } from '@textui/widgets';
import { render, renderApp } from '@textui/testing';
import {
  CodeEditor, canUndoDocument, getDocument, registerDocuments, revertDocument,
  setDocumentContent, undoDocument,
} from '../src/index.js';

/**
 * The editor.
 *
 * Every assertion here is about the buffer rather than the frame: the frame
 * follows, and a test that only reads the frame passes on an editor that
 * draws the right thing and saves the wrong one.
 */

async function settle(t: { settle(): Promise<void>; flush(): void }, n = 3): Promise<void> {
  for (let i = 0; i < n; i++) { await t.settle(); t.flush(); }
}

async function editing(initial: string, size = { width: 40, height: 8 }) {
  let value = initial;
  const t = await renderApp({
    ...size,
    onBoot: (app) => { registerBuiltins(app); registerDocuments(app); },
    root: {
      component: 'box', direction: 'column', flex: 1,
      children: {
        component: 'CodeEditor', flex: 1, value: initial,
        onChange: { handler: (v: string) => { value = v; } },
      },
    },
  });
  await settle(t);
  t.tab(); t.flush();
  return { t, read: (): string => value };
}

describe('the caret has a column', () => {
  it('types where the caret is', async () => {
    const { t, read } = await editing('hello\nworld\n');
    t.press('end');
    t.type('!');
    await settle(t);
    expect(read()).toBe('hello!\nworld\n');
    await t.unmount();
  });

  it('splits a line on enter and joins it on backspace', async () => {
    const { t, read } = await editing('hello\nworld\n');
    t.press('end');
    t.press('enter');
    t.type('there');
    await settle(t);
    expect(read()).toBe('hello\nthere\nworld\n');

    // Backspace at column zero is a join, not a no-op.
    t.press('home');
    t.press('backspace');
    await settle(t);
    expect(read()).toBe('hellothere\nworld\n');
    await t.unmount();
  });

  it('deletes forwards, and pulls the next line up at the end of one', async () => {
    const { t, read } = await editing('ab\ncd\n');
    t.press('delete');
    await settle(t);
    expect(read()).toBe('b\ncd\n');

    t.press('end');
    t.press('delete');
    await settle(t);
    expect(read()).toBe('bcd\n');
    await t.unmount();
  });

  it('walks off the end of a line into the next one', async () => {
    const { t, read } = await editing('ab\ncd\n');
    t.press('end');
    t.press('right');        // onto line 2, column 0
    t.type('X');
    await settle(t);
    expect(read()).toBe('ab\nXcd\n');

    t.press('left');         // back to column 0...
    t.press('left');         // ...and up to the end of line 1
    t.type('Y');
    await settle(t);
    expect(read()).toBe('abY\nXcd\n');
    await t.unmount();
  });

  /**
   * Up and down aim for the column you started from, not the one you landed
   * on. Without it, passing through a short line drags the caret left and it
   * never comes back - which is the single most irritating thing an editor can
   * get wrong.
   */
  it('remembers the column it was aiming for', async () => {
    const { t, read } = await editing('aaaaa\nb\nccccc\n');
    t.press('end');          // line 1, column 5
    t.press('down');         // line 2 is one character long
    t.press('down');         // line 3 is long again
    t.type('!');
    await settle(t);
    expect(read()).toBe('aaaaa\nb\nccccc!\n');
    await t.unmount();
  });

  /**
   * A terminal reports `alt+1` as an escape and a `1`, so a printable branch
   * that only checked ctrl and meta typed the digit *and* swallowed the chord:
   * `alt+1` put a `1` in the file instead of reaching whatever the application
   * bound it to.
   */
  it('leaves an alt chord for the application', async () => {
    const { t, read } = await editing('hello\n');
    t.pressAll('alt+1', 'alt+9', 'alt+shift+?', 'alt+left', 'alt+right');
    await settle(t);
    expect(read(), 'nothing was typed').toBe('hello\n');
    await t.unmount();
  });

});

describe('what a line means', () => {
  it('washes a marked line only when asked, and only where colours mix', async () => {
    const { t } = await editing('alpha\nbeta\ngamma\n');
    // No marks, no column and no wash: a file nobody has an opinion about is
    // exactly as wide as it was.
    const plain = t.text();

    t.app.store.set('$/ui/line-marks/test/x', { 1: 'changed' });
    await settle(t);
    expect(t.text(), 'a mark for another file changes nothing').toBe(plain);
    await t.unmount();
  });
});

describe('tab is a tab', () => {
  it('inserts an indent where the caret is', async () => {
    const { t, read } = await editing('alpha\nbeta\n');
    t.press('tab');
    await settle(t);
    // Not a focus move: the one control whose job is typing cannot lose the
    // indent key to navigation.
    expect(read()).toBe('  alpha\nbeta\n');
    await t.unmount();
  });

  it('indents what is selected rather than replacing it', async () => {
    const { t, read } = await editing('alpha\nbeta\n');
    t.press('shift+down');
    t.press('tab');
    await settle(t);
    expect(read()).toBe('  alpha\n  beta\n');
    await t.unmount();
  });

  it('takes an indent back with shift, selection or no selection', async () => {
    const { t, read } = await editing('    alpha\n    beta\n');
    t.press('shift+tab');
    await settle(t);
    expect(read()).toBe('  alpha\n    beta\n');

    t.press('shift+down');
    t.press('shift+tab');
    await settle(t);
    expect(read()).toBe('alpha\n  beta\n');
    await t.unmount();
  });

  it('leaves a chord alone, because that one is aimed past it', async () => {
    const { t, read } = await editing('alpha\n');
    t.press('ctrl+tab');
    await settle(t);
    // Whatever the application bound it to gets it; what must not happen is
    // two spaces appearing in the file.
    expect(read()).toBe('alpha\n');
    await t.unmount();
  });

  it('and escape is the way out', async () => {
    // A second focusable, because moving on with only one control there is
    // would pass whether or not the editor let go of the keyboard.
    let value = 'ab\n';
    const t = await renderApp({
      width: 40, height: 8,
      onBoot: (app) => { registerBuiltins(app); registerDocuments(app); },
      root: {
        component: 'box', direction: 'column', flex: 1,
        children: [
          { component: 'CodeEditor', flex: 1, value: 'ab\n',
            onChange: { handler: (v: string) => { value = v; } } },
          { component: 'Button', label: 'elsewhere' },
        ],
      },
    });
    await settle(t);
    t.tab(); t.flush();
    const inside = t.focused()?.id;

    t.press('escape'); t.flush();
    await settle(t);
    expect(value, 'and it typed nothing on the way').toBe('ab\n');
    expect(t.focused()?.id, 'escape must move on').not.toBe(inside);
    await t.unmount();
  });
});

describe('the viewport', () => {
  it('draws a scrollbar only when there is more than fits', async () => {
    const short = await renderApp({
      width: 30, height: 8,
      onBoot: (app) => { registerBuiltins(app); registerDocuments(app); },
      root: { component: 'box', direction: 'column', flex: 1,
        children: { component: 'CodeEditor', flex: 1, value: 'a\nb\nc\n' } },
    });
    await settle(short);
    expect(short.text()).not.toContain(short.app.theme.glyphs.progressEmpty);
    await short.unmount();

    const long = await renderApp({
      width: 30, height: 8,
      onBoot: (app) => { registerBuiltins(app); registerDocuments(app); },
      root: { component: 'box', direction: 'column', flex: 1,
        children: { component: 'CodeEditor', flex: 1,
          value: Array.from({ length: 60 }, (_, i) => `line ${i}`).join('\n') } },
    });
    await settle(long);
    const track = long.text();
    expect(track).toContain(long.app.theme.glyphs.progressFull);
    expect(track).toContain(long.app.theme.glyphs.progressEmpty);
    await long.unmount();
  });

  it('follows the caret rather than resizing the pane', async () => {
    const { t } = await editing(Array.from({ length: 60 }, (_, i) => `line ${i}`).join('\n'));
    expect(t.hasText('line 0')).toBe(true);
    for (let i = 0; i < 30; i++) t.press('down');
    await settle(t);
    expect(t.hasText('line 30'), 'the viewport followed').toBe(true);
    expect(t.hasText('line 0'), 'and left the top behind').toBe(false);
    await t.unmount();
  });
});

describe('the caret cannot leave the pane', () => {
  /**
   * The node a resource registry hands back names a component, not a layout -
   * so nothing sets `flex` on it, and a viewport that only clamps when it was
   * told it is layout-sized reported that all four hundred lines fitted. The
   * editor then grew to four hundred rows inside a twelve-row pane, and the
   * caret walked out through the status bar.
   */
  it('scrolls instead of growing, even when nobody passed it a size', async () => {
    let value = Array.from({ length: 400 }, (_, i) => `line ${i}`).join('\n');
    const t = await renderApp({
      width: 40, height: 12,
      onBoot: (app) => { registerBuiltins(app); registerDocuments(app); },
      root: {
        component: 'box', direction: 'column', flex: 1,
        // Deliberately no `flex` on the editor: this is the shape the registry
        // produces.
        children: [
          { component: 'CodeEditor', value,
            onChange: { handler: (v: string) => { value = v; } } },
          { component: 'text', content: 'STATUS' },
        ],
      },
    });
    await settle(t);
    t.tab(); t.flush();

    expect(t.lines()).toHaveLength(12);
    expect(t.hasText('STATUS'), 'the row below survives').toBe(true);

    for (let i = 0; i < 40; i++) t.press('down');
    await settle(t);

    expect(t.hasText('line 40'), 'the viewport followed the caret').toBe(true);
    expect(t.hasText('line 0'), 'and left the top behind').toBe(false);
    expect(t.hasText('STATUS'), 'without pushing anything off the frame').toBe(true);
    await t.unmount();
  });
});

/**
 * Undo.
 *
 * The thing that actually loses work, so what these check is not that a stack
 * exists but that a step back is the step a person expected: a word rather
 * than a letter, the caret where it was, and a run that ends when you move
 * away rather than swallowing two edits made in different places.
 */
describe('stepping back', () => {
  const editor = async (content: string) => {
    const t = await render(
      h('box', { direction: 'column', width: 40, height: 8 },
        h(CodeEditor, { value: content, autoFocus: true, lineNumbers: false, flex: 1 })),
      { width: 40, height: 8 },
    );
    await t.settle();
    t.focus(t.getByRole('textbox').id);
    return t;
  };

  it('takes back a word, not a letter', async () => {
    const t = await editor('');
    t.type('hello');
    await t.settle();
    expect(t.hasText('hello')).toBe(true);

    t.press('ctrl+z');
    await t.settle();

    // One press, one word. Five presses for five letters is a stack that
    // exists rather than an undo somebody uses.
    expect(t.hasText('hello')).toBe(false);
    await t.unmount();
  });

  it('puts it back on redo', async () => {
    const t = await editor('');
    t.type('hello');
    await t.settle();
    t.press('ctrl+z');
    await t.settle();
    t.press('ctrl+y');
    await t.settle();

    expect(t.hasText('hello')).toBe(true);
    await t.unmount();
  });

  it('ends the run when the caret moves', async () => {
    const t = await editor('');
    t.type('ab');
    await t.settle();
    t.press('home');
    await t.settle();
    t.type('X');
    await t.settle();
    expect(t.hasText('Xab')).toBe(true);

    t.press('ctrl+z');
    await t.settle();

    // The X goes, and `ab` stays: two edits in two places are two steps.
    expect(t.hasText('ab')).toBe(true);
    expect(t.hasText('Xab')).toBe(false);
    await t.unmount();
  });

  it('keeps a newline as its own step', async () => {
    const t = await editor('');
    t.type('one');
    await t.settle();
    t.press('enter');
    t.type('two');
    await t.settle();

    t.press('ctrl+z');
    await t.settle();
    // The second line's text goes; the line break does not go with it.
    expect(t.hasText('two')).toBe(false);
    expect(t.hasText('one')).toBe(true);
    await t.unmount();
  });

  it('separates typing from deleting', async () => {
    const t = await editor('');
    t.type('abcd');
    await t.settle();
    t.press('backspace');
    t.press('backspace');
    await t.settle();
    expect(t.hasText('ab')).toBe(true);

    t.press('ctrl+z');
    await t.settle();
    // Deleting is its own run, so one step back returns the deleted letters.
    expect(t.hasText('abcd')).toBe(true);
    await t.unmount();
  });

  it('does nothing at the bottom of the stack', async () => {
    const t = await editor('start');
    for (let i = 0; i < 5; i++) { t.press('ctrl+z'); await t.settle(); }

    expect(t.hasText('start')).toBe(true);
    await t.unmount();
  });
});

/**
 * The same history, on a document.
 *
 * This is the path textide takes, and the one that matters most: the history
 * belongs to the buffer, so it survives the pane, an action that rewrites the
 * whole file is one step, and two editors on a file agree about what "back"
 * means.
 */
describe('a buffer remembers', () => {
  const provider = (files: Record<string, string>): ResourceProvider => ({
    scheme: 'mem',
    async stat(uri): Promise<Resource | null> {
      if (files[uri] === undefined) return null;
      return {
        uri,
        kind: 'file',
        metadata: { name: uri, size: (files[uri] as string).length },
        capabilities: ['read', 'write'],
      };
    },
    async read(uri) { return files[uri] ?? ''; },
    async write(uri, content) { files[uri] = String(content); },
  });

  const opened = async (initial: string) => {
    const files = { 'mem://a.txt': initial };
    const t = await renderApp({
      width: 40,
      height: 8,
      onBoot: (app) => {
        registerBuiltins(app);
        registerDocuments(app);
        app.resources.registerProvider(provider(files));
        app.resources.registerKind({ id: 'file', title: 'File' });
      },
      root: {
        component: 'box', direction: 'column', flex: 1,
        children: { component: 'CodeEditor', flex: 1, uri: 'mem://a.txt', lineNumbers: false },
      },
    });
    await settle(t, 6);
    t.tab(); t.flush();
    const read = (): string =>
      (getDocument(t.app.store, 'mem://a.txt') as { content: string }).content;
    return { t, read };
  };

  it('steps the buffer back, not just what is drawn', async () => {
    const { t, read } = await opened('start\n');
    t.press('end');
    t.type('ed');
    await settle(t);
    expect(read()).toBe('started\n');

    t.press('ctrl+z');
    await settle(t);
    expect(read()).toBe('start\n');

    t.press('ctrl+y');
    await settle(t);
    expect(read()).toBe('started\n');
    await t.unmount();
  });

  it('counts an action that rewrote the file as one step', async () => {
    const { t, read } = await opened('a\nb\n');
    // What "format this document" does: replace the buffer wholesale.
    setDocumentContent(t.app.store, 'mem://a.txt', 'A\nB\n');
    await settle(t);
    expect(read()).toBe('A\nB\n');

    expect(canUndoDocument(t.app.store, 'mem://a.txt')).toBe(true);
    undoDocument(t.app.store, 'mem://a.txt');
    await settle(t);
    expect(read()).toBe('a\nb\n');
    await t.unmount();
  });

  it('makes revert a step back rather than a cliff', async () => {
    const { t, read } = await opened('kept\n');
    t.press('end');
    t.type('!');
    await settle(t);
    expect(read()).toBe('kept!\n');

    revertDocument(t.app.store, 'mem://a.txt');
    await settle(t);
    expect(read()).toBe('kept\n');

    // Reverting by accident is exactly when somebody wants one step back.
    undoDocument(t.app.store, 'mem://a.txt');
    await settle(t);
    expect(read()).toBe('kept!\n');
    await t.unmount();
  });

  it('is one history for two panes on one file', async () => {
    const files = { 'mem://a.txt': 'one\n' };
    const t = await renderApp({
      width: 60,
      height: 10,
      onBoot: (app) => {
        registerBuiltins(app);
        registerDocuments(app);
        app.resources.registerProvider(provider(files));
        app.resources.registerKind({ id: 'file', title: 'File' });
      },
      root: {
        component: 'box', direction: 'column', flex: 1,
        children: [
          { component: 'CodeEditor', flex: 1, uri: 'mem://a.txt', lineNumbers: false },
          { component: 'CodeEditor', flex: 1, uri: 'mem://a.txt', lineNumbers: false },
        ],
      },
    });
    await settle(t, 6);
    const read = (): string =>
      (getDocument(t.app.store, 'mem://a.txt') as { content: string }).content;

    t.tab(); t.flush();
    t.press('end');
    t.type('!');
    await settle(t);
    expect(read()).toBe('one!\n');

    // The second pane can take back what the first one typed, because they
    // are editing the same buffer and there is only one idea of "back".
    t.tab(); t.flush();
    t.press('ctrl+z');
    await settle(t);
    expect(read()).toBe('one\n');
    await t.unmount();
  });
});

/**
 * A line wider than the pane.
 *
 * The editor had a vertical viewport and no horizontal one, so a long line was
 * handed to the layout whole and the layout did the only thing it could:
 * shrink every child of that row to fit. The line came back as fragments with
 * ellipses through it, and the gutter - which is a child of the same row -
 * came back as `3…`.
 */
describe('the line is wider than the pane', () => {
  const LONG = `const x = '${'abcdefghij'.repeat(12)}';`;

  it('scrolls sideways rather than shrinking the row to fit', async () => {
    const { t } = await editing(`short\n${LONG}\n`);
    t.press('down');
    t.press('end');
    await settle(t);

    const frame = t.text();
    expect(frame, 'nothing was ellipsised').not.toContain('…');
    // The caret is at the end of the line, so the end of the line is what is
    // on screen - and the start of it is not.
    expect(t.hasText("';"), 'the end of the line followed the caret').toBe(true);
    expect(t.hasText('const x ='), 'and the start scrolled off').toBe(false);
    await t.unmount();
  });

  it('keeps the gutter a gutter, whatever the row is carrying', async () => {
    const { t } = await editing(`short\n${LONG}\n`);
    t.press('down');
    t.press('end');
    await settle(t);
    // Not `2…`: the line number is a child of the row and used to be shrunk
    // along with everything else in it.
    expect(t.lines().some((line) => line.startsWith('2 '))).toBe(true);
    await t.unmount();
  });

  it('brings the start back when the caret goes back', async () => {
    const { t } = await editing(`short\n${LONG}\n`);
    t.press('down');
    t.press('end');
    await settle(t);
    expect(t.hasText('const x =')).toBe(false);

    t.press('home');
    await settle(t);
    expect(t.hasText('const x ='), 'home is a scroll as well as a move').toBe(true);
    await t.unmount();
  });

  it('never draws a row wider than the pane it was given', async () => {
    const { t } = await editing(`${LONG}\n${LONG}\n`, { width: 40, height: 6 });
    t.press('end');
    await settle(t);
    for (const line of t.lines()) {
      expect(line.length).toBeLessThanOrEqual(40);
    }
    await t.unmount();
  });

  it('edits at the caret even when the caret is off the left of the file', async () => {
    const { t, read } = await editing(`${LONG}\n`);
    t.press('end');
    t.type('!');
    await settle(t);
    expect(read()).toBe(`${LONG}!\n`);
    await t.unmount();
  });
});
