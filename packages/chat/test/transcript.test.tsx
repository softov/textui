import { describe, expect, it } from 'vitest';
import { h } from '@textui/core';
import { renderApp } from '@textui/testing';
import type { Harness } from '@textui/testing';
import { ChatTranscript, selectable } from '../src/index.js';
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

describe('what is selectable', () => {
  it('is the blocks that open, or can be withdrawn', () => {
    expect(BLOCKS.filter(selectable).map((b) => b.id)).toEqual(['r2', 'c1', 'q1']);
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
