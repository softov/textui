import { describe, expect, it } from 'vitest';
import { defineComponent, findMatches, h, matchAt, stepMatch, useEffect, useRuntime, useStoreValue } from '@textui/core';
import { render } from '../src/index.js';

/**
 * Finding things in text.
 *
 * Pure string work, kept out of the editor because a viewer wants it too, and
 * so will a results panel. Nothing here knows what a caret is.
 */

const TEXT = 'alpha beta\nbeta gamma\nBETA\n';

describe('matching', () => {
  it('finds every occurrence, in reading order', () => {
    expect(findMatches(TEXT, { text: 'beta' })).toEqual([
      { line: 0, start: 6, end: 10 },
      { line: 1, start: 0, end: 4 },
      { line: 2, start: 0, end: 4 },
    ]);
  });

  it('ignores case unless asked', () => {
    expect(findMatches(TEXT, { text: 'beta', matchCase: true })).toHaveLength(2);
  });

  it('does not overlap itself', () => {
    // `aa` in `aaaa` is two matches, not three: a search steps past what it
    // found, which is what "next" means when you press it twice.
    expect(findMatches('aaaa', { text: 'aa' })).toEqual([
      { line: 0, start: 0, end: 2 },
      { line: 0, start: 2, end: 4 },
    ]);
  });

  it('finds nothing for nothing', () => {
    expect(findMatches(TEXT, { text: '' })).toEqual([]);
  });
});

describe('stepping', () => {
  const matches = findMatches(TEXT, { text: 'beta' });

  it('goes to the next one after the caret', () => {
    expect(stepMatch(matches, { line: 0, column: 0 }, 1)).toBe(0);
    expect(stepMatch(matches, { line: 0, column: 6 }, 1)).toBe(1);
  });

  it('moves even when the caret is sitting on one', () => {
    // From *after* the caret. Otherwise next is a key that does nothing.
    expect(stepMatch(matches, { line: 1, column: 0 }, 1)).toBe(2);
  });

  it('wraps at both ends', () => {
    expect(stepMatch(matches, { line: 9, column: 0 }, 1)).toBe(0);
    expect(stepMatch(matches, { line: 0, column: 0 }, -1)).toBe(2);
  });

  it('says which one the caret is in', () => {
    expect(matchAt(matches, { line: 1, column: 2 })).toBe(1);
    expect(matchAt(matches, { line: 1, column: 8 })).toBe(-1);
  });

  it('has nothing to say about no matches', () => {
    expect(stepMatch([], { line: 0, column: 0 }, 1)).toBe(-1);
  });
});

describe('stepping back off a match', () => {
  const matches = findMatches(TEXT, { text: 'beta' });

  it('moves when the caret is at the end of one', () => {
    // Stepping to a match leaves the caret at its end, so this is where
    // `previous` is pressed from every time - and comparing starts instead of
    // ends found the match under the caret and called it the previous one.
    expect(stepMatch(matches, { line: 1, column: 4 }, -1)).toBe(0);
  });

  it('and from inside unchanged text, finds the one above', () => {
    expect(stepMatch(matches, { line: 1, column: 8 }, -1)).toBe(1);
  });
});

/**
 * A write that lands between a render and its subscription.
 *
 * Subscribing happens in an effect, so a component that reads a path in the
 * same frame that something else writes it has already missed the
 * notification - and without a check after subscribing it never hears about
 * that value again. A status bar reading which panel has the keyboard is
 * exactly this shape, and it stayed empty for the life of the process.
 */
describe('reading a path something else is about to write', () => {
  it('sees the value anyway', async () => {
    const Writer = defineComponent('Writer', () => {
      const runtime = useRuntime();
      // In an effect, so it lands after the reader below has rendered.
      useEffect(() => { runtime.store.set('$/app/late', 'arrived'); }, []);
      return h('text', { content: 'w' });
    });

    const Reader = defineComponent('Reader', () => {
      const value = useStoreValue<string>('$/app/late', 'nothing');
      return h('text', { content: `read: ${value ?? 'nothing'}` });
    });

    const t = await render(
      h('box', { direction: 'column' }, h(Reader, {}), h(Writer, {})),
      { width: 40, height: 4 },
    );
    for (let i = 0; i < 4; i++) { await t.settle(); t.flush(); }

    expect(t.hasText('read: arrived')).toBe(true);
    await t.unmount();
  });
});
