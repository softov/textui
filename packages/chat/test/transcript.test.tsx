import { describe, expect, it } from 'vitest';
import type { Color } from '@textui/core';
import { h } from '@textui/core';
import { renderApp } from '@textui/testing';
import type { Harness } from '@textui/testing';
import { ChatTranscript, findBlocks, selectable } from '../src/index.js';
import type { Block, ChatToolCall } from '../src/index.js';

/**
 * The transcript draws every block kind, and only the ones that open or can
 * be withdrawn take the cursor.
 */

const CALL: ChatToolCall = { id: 'c1', name: 'Bash', status: 'completed', input: 'ls', output: 'a\nb' };

const BLOCKS: Block[] = [
  { kind: 'said', id: 's1', turnId: 't1', text: 'hello there' },
  { kind: 'header', id: 'h2', turnId: 't2', model: 'claude', meta: '1.2s', state: 'complete' },
  { kind: 'reasoning', id: 'r2', turnId: 't2', content: 'let me think', streaming: false },
  { kind: 'prose', id: 'p2', turnId: 't2', content: 'here is the answer', streaming: false },
  { kind: 'tool', id: 'c1', turnId: 't2', call: CALL },
  { kind: 'notice', id: 'n2', turnId: 't2', content: 'context compacted' },
  { kind: 'failure', id: 'f2', turnId: 't2', content: 'the host went away', resumable: true },
  { kind: 'queued', id: 'q1', messageId: 'm1', text: 'and then this' },
];

const open = async (props: Record<string, unknown> = {}): Promise<Harness> => {
  const t = await renderApp({
    width: 60,
    height: 24,
    root: h(ChatTranscript, { blocks: BLOCKS, expanded: {}, onToggle: () => undefined, ...props }),
  });
  await t.settle();
  return t;
};

describe('the transcript', () => {
  it('draws one of every kind', async () => {
    const t = await open();
    for (const text of [
      'hello there', 'claude', '1.2s', 'thought, 3 words', 'here is the answer', 'Bash',
      'context compacted', 'the host went away', 'resumable', 'and then this', 'queued',
    ]) {
      expect(t.hasText(text), text).toBe(true);
    }
    expect(t.errors()).toEqual([]);
    await t.unmount();
  });

  it('keeps folded content folded until it is expanded', async () => {
    const closed = await open();
    expect(closed.hasText('a')).toBe(true);
    expect(closed.lines().some((l) => /^\s*b\s*$/.test(l))).toBe(false);
    await closed.unmount();

    const opened = await open({ expanded: { c1: true, r2: true } });
    expect(opened.lines().some((l) => /^\s*b\s*$/.test(l))).toBe(true);
    await opened.unmount();
  });

  it('opens a thought on a click, the way it opens a tool row', async () => {
    const toggled: string[] = [];
    const t = await open({ onToggle: (id: string) => toggled.push(id) });
    const row = t.lines().findIndex((line) => line.includes('thought, 3 words'));
    t.click(6, row);
    await t.settle();
    expect(toggled).toEqual(['r2']);
    await t.unmount();
  });

  it('says what the cursor on a queued message is for', async () => {
    const t = await open({ cursor: 7 });
    expect(t.hasText('enter drops it')).toBe(true);
    await t.unmount();
  });

  it('puts the head ahead of the blocks and not in the indices', async () => {
    const t = await open({ head: h('text', { content: 'Session one' }), cursor: 7 });
    const lines = t.lines();
    expect(lines.findIndex((l) => l.includes('Session one'))).toBeLessThan(lines.findIndex((l) => l.includes('hello there')));
    expect(t.hasText('enter drops it')).toBe(true);
    await t.unmount();
  });
});

/**
 * The cursor is drawn in a gutter every block has, as a heavy bar in the
 * accent colour, so a paragraph of prose or a turn header shows where the
 * cursor is as plainly as a tool row does. Tool rows and thoughts keep their
 * background as well, and turn their text inverted on it.
 */
describe('the cursor', () => {
  /** A theme colour as the buffer holds it: the built-in themes write hex. */
  const asRgb = (color: Color): Color => {
    if (typeof color !== 'string' || !color.startsWith('#')) return color;
    return { rgb: [parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16)] };
  };
  const rowOf = (t: Harness, text: string): number => t.lines().findIndex((line) => line.includes(text));

  it('draws the bar down the gutter of whichever block it is on', async () => {
    for (const [cursor, text] of [[0, 'hello there'], [1, 'claude'], [3, 'here is the answer'], [4, 'Bash'], [5, 'context compacted'], [6, 'the host went away'], [7, 'and then this']] as const) {
      const t = await open({ cursor });
      const cell = t.app.buffer().get(0, rowOf(t, text));
      expect(cell?.char, text).toBe(t.app.theme.borderChars('bold').left);
      expect(cell?.fg, text).toEqual(asRgb(t.app.theme.color('accent')));
      await t.unmount();
    }
  });

  it('marks every line of a block, not only its first', async () => {
    const t = await open({ cursor: 2, expanded: { r2: true } });
    const bar = t.app.theme.borderChars('bold').left;
    expect(t.app.buffer().get(0, rowOf(t, 'thought, 3 words'))?.char).toBe(bar);
    expect(t.app.buffer().get(0, rowOf(t, 'let me think'))?.char).toBe(bar);
    await t.unmount();
  });

  /**
   * A glyph that already holds the left column is that block's gutter cell,
   * and the bar takes its place: the block does not move when the cursor
   * arrives. The header used to gain a blank column and a gap and start two
   * cells to the right of the user's line above it.
   */
  it('stands in for the glyph that already holds the left column', async () => {
    const bar = (t: Harness): string => t.app.theme.borderChars('bold').left;
    const header = await open({ cursor: 1 });
    expect(header.lines()[rowOf(header, 'claude')]?.startsWith(`${bar(header)} claude`)).toBe(true);
    await header.unmount();

    const said = await open({ cursor: 0 });
    expect(said.lines()[rowOf(said, 'you')]?.startsWith(`${bar(said)} you`)).toBe(true);
    expect(said.lines()[rowOf(said, 'hello there')]?.startsWith(`${bar(said)} hello there`)).toBe(true);
    await said.unmount();

    // At rest, the glyphs are back and in column 0.
    const rest = await open({ cursor: 4 });
    expect(rest.lines()[rowOf(rest, 'claude')]?.startsWith('● claude')).toBe(true);
    expect(rest.lines()[rowOf(rest, 'you')]?.startsWith('▸ you')).toBe(true);
    await rest.unmount();
  });

  it('leaves the gutter blank on the blocks that are neither said nor a turn header', async () => {
    const t = await open({ cursor: 0 });
    for (const text of ['Bash', 'context compacted', 'the host went away', 'and then this']) {
      expect(t.app.buffer().get(0, rowOf(t, text))?.char, text).toBe(' ');
    }
    // And keeps the rule on the ones that are said.
    expect(t.app.buffer().get(0, rowOf(t, 'here is the answer'))?.char).toBe(t.app.theme.borderChars().left);
    await t.unmount();
  });

  it('starts a tool row where the prose starts, and a header where the user line does', async () => {
    const t = await open();
    const column = (text: string): number => t.lines()[rowOf(t, text)]?.indexOf(text) ?? -1;
    // The status glyph sits where the rule does on the prose, one gap in.
    expect(t.lines()[rowOf(t, 'Bash')]?.indexOf('✓')).toBe(column('here is the answer'));
    expect(t.lines()[rowOf(t, 'claude')]?.indexOf('●')).toBe(0);
    expect(t.lines()[rowOf(t, 'you')]?.indexOf('▸')).toBe(0);
    await t.unmount();
  });

  it("turns a selected tool row's words inverted and keeps its status glyph", async () => {
    const t = await open({ cursor: 4 });
    const y = rowOf(t, 'Bash');
    const name = t.app.buffer().get(t.lines()[y]?.indexOf('Bash') ?? 0, y);
    const glyph = t.app.buffer().get(t.lines()[y]?.indexOf('✓') ?? 0, y);
    expect(name?.fg).toEqual(asRgb(t.app.theme.color('inverted')));
    expect(name?.bg).toEqual(asRgb(t.app.theme.color('selected')));
    expect(glyph?.fg).toEqual(asRgb(t.app.theme.color('success')));
    await t.unmount();
  });

  it("turns a selected thought's words inverted, open or folded", async () => {
    const t = await open({ cursor: 2, expanded: { r2: true } });
    for (const text of ['thought, 3 words', 'let me think']) {
      const y = rowOf(t, text);
      const cell = t.app.buffer().get(t.lines()[y]?.indexOf(text) ?? 0, y);
      expect(cell?.fg, text).toEqual(asRgb(t.app.theme.color('inverted')));
      expect(cell?.bg, text).toEqual(asRgb(t.app.theme.color('selected')));
    }
    await t.unmount();
  });

  it('paints no background on prose or on what the person said', async () => {
    const t = await open({ cursor: 0 });
    const y = rowOf(t, 'hello there');
    const said = t.app.buffer().get(t.lines()[y]?.indexOf('hello') ?? 0, y);
    expect(said?.bg).not.toEqual(asRgb(t.app.theme.color('selected')));
    await t.unmount();
  });
});

describe('what is selectable', () => {
  it('is the blocks that open, or can be withdrawn', () => {
    expect(BLOCKS.filter(selectable).map((b) => b.id)).toEqual(['r2', 'c1', 'q1']);
  });
});

/**
 * Where a term appears, as block indices, so a find box can walk them with
 * the cursor. Everything a person could be looking for counts: the model on a
 * header, the output of a tool call.
 */
describe('finding in the blocks', () => {
  it('matches without regard to case', () => {
    expect(findBlocks(BLOCKS, 'HELLO')).toEqual([0]);
    expect(findBlocks(BLOCKS, 'Answer')).toEqual(findBlocks(BLOCKS, 'answer'));
    // In order, and every block holding it: the person's line, the prose,
    // the failure and the queued message all say "the" somewhere.
    expect(findBlocks(BLOCKS, 'the')).toEqual([0, 3, 6, 7]);
  });

  it('finds nothing for a blank query, rather than everything', () => {
    expect(findBlocks(BLOCKS, '')).toEqual([]);
    expect(findBlocks(BLOCKS, '   ')).toEqual([]);
  });

  it('finds a header by its model', () => {
    expect(findBlocks(BLOCKS, 'claude')).toEqual([1]);
  });

  it('finds a tool call by what came back', () => {
    expect(findBlocks(BLOCKS, 'b')).toEqual([4]);
    expect(findBlocks(BLOCKS, 'Bash')).toEqual([4]);
  });
});

/**
 * The find box hands the term down, and the transcript colours it where it
 * appears rather than filtering to the lines that hold it. The cursor is how
 * a hit is reached, so a pinned cursor is one the feed keeps on screen even
 * when it did not move.
 */
describe('a match', () => {
  it('is coloured where it appears', async () => {
    const t = await open({ match: 'answer' });
    const lines = t.lines();
    const y = lines.findIndex((line) => line.includes('answer'));
    expect(y).toBeGreaterThan(-1);
    const x = (lines[y] as string).indexOf('answer');
    const hit = t.app.buffer().get(x, y);
    const before = t.app.buffer().get(x - 1, y);
    expect(JSON.stringify(hit?.bg)).not.toBe(JSON.stringify(before?.bg));
    await t.unmount();
  });

  it('reaches the words a person said, a notice and a queued message too', async () => {
    const t = await open({ match: 'th' });
    // Every block with the term lights up, not the first one only.
    for (const text of ['hello there', 'the host went away', 'and then this']) {
      const y = t.lines().findIndex((line) => line.includes(text));
      const x = (t.lines()[y] as string).indexOf('th');
      const hit = t.app.buffer().get(x, y);
      const before = t.app.buffer().get(x - 1, y);
      expect(JSON.stringify(hit?.bg), text).not.toBe(JSON.stringify(before?.bg));
    }
    await t.unmount();
  });
});

describe('a pinned cursor', () => {
  const prose = (count: number): Block[] => Array.from({ length: count }, (_, i) => ({
    kind: 'prose', id: `p${i}`, turnId: 't', content: `paragraph ${i} of many`, streaming: false,
  }));
  const tall = async (props: Record<string, unknown>): Promise<Harness> => {
    const t = await renderApp({
      width: 60,
      height: 10,
      root: h(ChatTranscript, {
        blocks: prose(40), expanded: {}, onToggle: () => undefined, cursor: 0, flex: 1, ...props,
      }),
    });
    for (let i = 0; i < 4; i += 1) await t.settle();
    return t;
  };

  it('is kept in view, where an unpinned one at the same index is not', async () => {
    // A feed opens at its tail, and the cursor's first value is not scrolled
    // to: the top of a conversation is off screen even with the cursor on it.
    const loose = await tall({});
    expect(loose.hasText('paragraph 0 of')).toBe(false);
    await loose.unmount();

    // Pinned, the feed brings the row the cursor is on back on screen without
    // the index having moved - which is what a find box's first hit needs.
    const pinned = await tall({ pinCursor: true });
    expect(pinned.hasText('paragraph 0 of')).toBe(true);
    await pinned.unmount();
  });
});

describe('the markdown switch', () => {
  it('reaches the prose and the reasoning from the transcript', async () => {
    const raw = await open({ blocks: [
      { kind: 'prose', id: 'p', turnId: 't', content: '**bold**', streaming: false },
      { kind: 'reasoning', id: 'r', turnId: 't', content: '_quiet_', streaming: false },
    ], expanded: { r: true }, markdown: false });
    expect(raw.hasText('**bold**')).toBe(true);
    expect(raw.hasText('_quiet_')).toBe(true);
    await raw.unmount();
  });
});
