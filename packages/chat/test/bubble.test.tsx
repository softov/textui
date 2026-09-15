import { describe, expect, it } from 'vitest';
import { h } from '@textui/core';
import { renderApp } from '@textui/testing';
import type { Harness } from '@textui/testing';
import { ChatBubble, ReasoningBlock, StreamingText } from '../src/index.js';

/**
 * The three ways one thing said is drawn.
 *
 * `StreamingText` used to read the application's markdown switch from a store
 * path; it is a prop now, and the only source. So the two things to check are
 * that the prop is honoured both ways and that leaving it off means markdown.
 */

const open = async (node: unknown, width = 40): Promise<Harness> => {
  const t = await renderApp({ width, height: 8, root: node as never });
  await t.settle();
  return t;
};

describe('streaming text', () => {
  it('renders markdown when nothing is said', async () => {
    const t = await open(h(StreamingText, { content: '**bold** and `code`' }));
    expect(t.text()).not.toContain('**');
    expect(t.hasText('bold and code')).toBe(true);
    await t.unmount();
  });

  it('shows the characters that arrived when told not to parse', async () => {
    const t = await open(h(StreamingText, { content: '**bold** and `code`', markdown: false }));
    expect(t.hasText('**bold** and `code`')).toBe(true);
    await t.unmount();
  });

  it('keeps the caret on the last word while streaming', async () => {
    const t = await open(h(StreamingText, { content: 'still arriving', streaming: true, markdown: false }));
    const line = t.lines().find((l) => l.includes('still arriving')) ?? '';
    expect(line.trim().length).toBeGreaterThan('still arriving'.length);
    await t.unmount();
  });
});

describe('a bubble', () => {
  it('names the speaker when no author is given', async () => {
    for (const [speaker, label] of [['user', 'you'], ['agent', 'agent'], ['system', 'system']] as const) {
      const t = await open(h(ChatBubble, { speaker }, h('text', { content: 'hi' })));
      expect(t.hasText(label)).toBe(true);
      expect(t.hasText('hi')).toBe(true);
      await t.unmount();
    }
  });

  it('puts the author and the meta on the head row', async () => {
    const t = await open(h(ChatBubble, { speaker: 'agent', author: 'claude', meta: '1.2s' }, h('text', { content: 'hi' })));
    const head = t.lines().find((l) => l.includes('claude')) ?? '';
    expect(head).toContain('1.2s');
    expect(t.lines().indexOf(head)).toBeLessThan(t.lines().findIndex((l) => l.includes('hi')));
    await t.unmount();
  });
});

describe('a reasoning block', () => {
  it('folds to one row with the summary', async () => {
    const t = await open(h(ReasoningBlock, { content: 'one two three', summary: 'thought for 2s' }));
    expect(t.hasText('thought for 2s')).toBe(true);
    expect(t.hasText('one two three')).toBe(false);
    await t.unmount();
  });

  it('counts the words when there is no summary', async () => {
    const t = await open(h(ReasoningBlock, { content: 'one two three' }));
    expect(t.hasText('thought, 3 words')).toBe(true);
    await t.unmount();
  });

  it('opens onto the content', async () => {
    const t = await open(h(ReasoningBlock, { content: 'one two three', expanded: true }));
    expect(t.hasText('one two three')).toBe(true);
    await t.unmount();
  });
});
