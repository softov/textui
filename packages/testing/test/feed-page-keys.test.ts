import { describe, expect, it } from 'vitest';
import { h, useState } from '@textui/core';
import { Column, Feed, TextArea } from '@textui/widgets';
import { renderApp } from '../src/index.js';

/*
 * Page up, from a field that is not the thing being paged.
 *
 * A transcript with a composer under it is one screen: somebody typing who
 * presses page up means the conversation above them, and there is nothing
 * else on that screen those keys could be for. Taking the keyboard off the
 * field to use them is exactly what a reader is trying to avoid.
 *
 * `global` handlers run only after the focused node has declined the key, so
 * a field that pages its own content still keeps them.
 */
describe('a Feed that keeps the page keys', () => {
  const open = async (pageKeys: 'focused' | 'always') => {
    const t = await renderApp({
      width: 40,
      height: 12,
      root: h(function Host() {
        const [text, setText] = useState('');
        return h(Column, { flex: 1 },
          h(Feed, { flex: 1, pageKeys, focusId: 'feed' },
            ...Array.from({ length: 40 }, (_, i) => h('text', { key: i, content: `line ${i}` }))),
          h(TextArea, { value: text, onChange: setText, focusId: 'field', blink: false }));
      }, {}),
    });
    await t.settle();
    t.focus('field');
    for (let i = 0; i < 4; i++) await t.settle();
    return t;
  };

  it('pages while a text field has the keyboard', async () => {
    const t = await open('always');
    // It opens on the tail, which is what a feed follows.
    expect(t.hasText('line 39')).toBe(true);

    t.press('pageup');
    for (let i = 0; i < 4; i++) await t.settle();
    expect(t.hasText('line 39')).toBe(false);
    // And the field still has it: nothing moved the keyboard.
    expect(t.app.focus.focused()).toBe('field');

    t.press('pagedown');
    for (let i = 0; i < 4; i++) await t.settle();
    expect(t.hasText('line 39')).toBe(true);
    await t.unmount();
  });

  it('leaves them alone by default', async () => {
    const t = await open('focused');
    expect(t.hasText('line 39')).toBe(true);

    t.press('pageup');
    for (let i = 0; i < 4; i++) await t.settle();
    expect(t.hasText('line 39')).toBe(true);
    await t.unmount();
  });

  it('does not take a key the field wanted', async () => {
    const t = await open('always');
    t.type('hello');
    for (let i = 0; i < 4; i++) await t.settle();

    // Ordinary typing is untouched by a global handler that only claims two
    // named keys after the focused node has declined them.
    expect(t.hasText('hello')).toBe(true);
    await t.unmount();
  });
});
