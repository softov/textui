import { describe, expect, it } from 'vitest';
import { h, useState } from '@textui/core';
import { Column, Feed, TextArea } from '@textui/widgets';
import { renderApp } from '../src/index.js';

/*
 * What a feed costs when nothing about it changed.
 *
 * A feed lays out every entry it holds, and laying one out means wrapping its
 * text - so a viewport a dozen rows tall over a long transcript spent every
 * frame measuring the hundreds of entries nobody can see. That is paid per
 * *frame*, not per change: a keystroke in the field underneath, a caret
 * blinking, a spinner somewhere else on the screen. It is why a long
 * conversation was heavy to type into and a short one was not.
 *
 * So the entries outside the viewport are replaced by a box of exactly the
 * height they were measured at. Nothing is estimated - the first frame draws
 * everything and learns every height - which is what lets the assertions
 * below be about the picture as well as the cost.
 */
describe('a Feed over more than it can show', () => {
  const open = async (count: number) => {
    const t = await renderApp({
      width: 40,
      height: 12,
      root: h(function Host() {
        const [text, setText] = useState('');
        return h(Column, { flex: 1 },
          h(Feed, { flex: 1, focusId: 'feed' },
            // Entries of more than one node each, which is what a feed is
            // for: the saving is everything an entry is made of, not the row
            // that holds it.
            ...Array.from({ length: count }, (_, i) => h(Column, { key: i },
              h('text', { content: `line ${i}` }),
              h('text', { content: `and its second row ${i}` }),
              h('text', { content: `and its third ${i}` })))),
          h(TextArea, { value: text, onChange: setText, focusId: 'field', blink: false }));
      }, {}),
    });
    for (let i = 0; i < 8; i++) await t.settle();
    t.focus('feed');
    for (let i = 0; i < 4; i++) await t.settle();
    return t;
  };

  it('shows the tail, and the tail is right', async () => {
    const t = await open(400);
    expect(t.hasText('line 399')).toBe(true);
    expect(t.hasText('line 398')).toBe(true);
    // Not the top of a four hundred line feed.
    expect(t.hasText('line 0')).toBe(false);
    await t.unmount();
  });

  it('keeps far more than it draws', async () => {
    const t = await open(400);
    // A row per entry stays, because that is what holds the height; what an
    // entry is made of does not.
    expect(t.stats().instances).toBeLessThan(400 * 3);
    await t.unmount();
  });

  it('grows by the row that holds an entry, not by what is in it', async () => {
    const small = await open(40);
    const large = await open(400);
    // Each entry here is seven nodes drawn - a wrapper, a column and three
    // texts with their boxes - and only the wrapper survives being out of
    // view, because only the wrapper is holding the height.
    const perEntry = (large.stats().instances - small.stats().instances) / (400 - 40);
    expect(perEntry).toBeLessThan(3);
    await small.unmount();
    await large.unmount();
  });

  it('still pages and scrolls through the whole of it', async () => {
    const t = await open(400);
    t.press('home');
    for (let i = 0; i < 6; i++) await t.settle();
    expect(t.hasText('line 0')).toBe(true);
    expect(t.hasText('line 399')).toBe(false);

    t.press('end');
    for (let i = 0; i < 6; i++) await t.settle();
    expect(t.hasText('line 399')).toBe(true);

    t.press('pageup');
    for (let i = 0; i < 6; i++) await t.settle();
    expect(t.hasText('line 399')).toBe(false);
    // Somewhere in the middle, and drawn - not a screenful of blanks where
    // the stand-ins were.
    expect(t.text().trim()).not.toBe('');
    await t.unmount();
  });

  it('draws everything again when it is made wider', async () => {
    const t = await open(400);
    t.resize(80, 12);
    for (let i = 0; i < 8; i++) await t.settle();
    // Heights are statements about a width, so a resize throws them away and
    // the feed learns them again rather than scrolling to a stale geometry.
    expect(t.hasText('line 399')).toBe(true);
    await t.unmount();
  });
});
