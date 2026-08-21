import { describe, expect, it } from 'vitest';
import { registerBuiltins } from '@textui/core';
import { renderApp } from '@textui/testing';
import { registerDocuments } from '../src/index.js';

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

  it('leaves tab alone, so focus can get out', async () => {
    // A second focusable, because tab wrapping to the only control there is
    // would pass whether or not the editor swallowed the key.
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

    t.tab(); t.flush();
    await settle(t);
    expect(value, 'tab must not type').toBe('ab\n');
    expect(t.focused()?.id, 'tab must move on').not.toBe(inside);
    await t.unmount();
  });
});
