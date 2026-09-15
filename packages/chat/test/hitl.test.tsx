import { describe, expect, it } from 'vitest';
import { defineComponent, h, useState } from '@textui/core';
import { renderApp } from '@textui/testing';
import type { Harness } from '@textui/testing';
import { ChatHitl, ChatInputStatus } from '../src/index.js';
import type { ChatAnswer, ChatPendingInput, ChatQuestion } from '../src/index.js';

/**
 * The block that means the agent is waiting on a person.
 *
 * The draft answers are controlled - they go out through `onDraft` and come
 * back in as `draft` - so the form must never keep a copy of its own, and
 * whoever mounts it decides where they live.
 */

const CONFIRM: ChatPendingInput = {
  kind: 'toolConfirmation',
  id: 'i1',
  call: {
    id: 'c1', name: 'Bash', status: 'pending-confirmation', input: 'rm -rf build',
    confirmationTitle: 'Run this?', intention: 'Clean the build folder',
    options: [{ id: 'once', label: 'Just this once' }, { id: 'always', label: 'Always' }],
  },
};

const question = (kind: ChatQuestion['kind'], extra: Partial<ChatQuestion> = {}): ChatQuestion => ({
  id: `q-${kind}`,
  kind,
  message: `A ${kind} question`,
  ...extra,
});

const ASK = (questions: ChatQuestion[]): ChatPendingInput => ({
  kind: 'chatInput', id: 'i2', message: 'Before I go on', questions,
});

interface Seen {
  approved: (string | undefined)[];
  denied: number;
  answered: { answers: Record<string, ChatAnswer>; accepted: boolean }[];
  drafts: Record<string, ChatAnswer>[];
}

/** Mounted with a draft held outside the block, as the screen would hold it. */
const open = async (input: ChatPendingInput): Promise<{ t: Harness; seen: Seen }> => {
  const seen: Seen = { approved: [], denied: 0, answered: [], drafts: [] };
  const Host = defineComponent('Host', () => {
    const [draft, setDraft] = useState<Record<string, ChatAnswer>>({});
    return h(ChatHitl, {
      input,
      draft,
      onDraft: (next: Record<string, ChatAnswer>) => { seen.drafts.push(next); setDraft(next); },
      onApprove: (id?: string) => { seen.approved.push(id); },
      onDeny: () => { seen.denied++; },
      onAnswer: (answers: Record<string, ChatAnswer>, accepted: boolean) => { seen.answered.push({ answers, accepted }); },
    });
  });
  const t = await renderApp({ width: 70, height: 24, theme: 'workbench', root: h(Host, {}) });
  await t.settle();
  await t.settle();
  return { t, seen };
};

describe('a tool confirmation', () => {
  it('shows the title, the intention, the command and the named options', async () => {
    const { t } = await open(CONFIRM);
    for (const text of ['Run this?', 'Clean the build folder', 'rm -rf build', 'Just this once', 'Always']) {
      expect(t.hasText(text), text).toBe(true);
    }
    await t.unmount();
  });

  it('answers on its letters and its numbers', async () => {
    const { t, seen } = await open(CONFIRM);
    t.press('a');
    await t.settle();
    t.press('d');
    await t.settle();
    t.press('2');
    await t.settle();
    expect(seen.approved).toEqual([undefined, 'always']);
    expect(seen.denied).toBe(1);
    await t.unmount();
  });
});

describe('a question form', () => {
  it('shows the request and every question', async () => {
    const { t } = await open(ASK([
      question('boolean'), question('single-select', { options: [{ id: 'x', label: 'Ex' }] }),
      question('multi-select', { options: [{ id: 'y', label: 'Why' }] }), question('text'), question('number'),
    ]));
    for (const text of ['Before I go on', 'A boolean question', 'Ex', 'Why', 'A text question', 'A number question']) {
      expect(t.hasText(text), text).toBe(true);
    }
    await t.unmount();
  });

  it('writes a choice through onDraft and reads it back from draft', async () => {
    const { t, seen } = await open(ASK([question('boolean')]));
    t.press('space');
    await t.settle();
    expect(seen.drafts).toEqual([{ 'q-boolean': { kind: 'boolean', value: true } }]);
    await t.unmount();
  });

  it('will not accept while a required question is empty', async () => {
    const { t, seen } = await open(ASK([question('boolean', { required: true })]));
    expect(t.hasText('required')).toBe(true);
    expect(t.hasText('1 still to answer')).toBe(true);
    // Send is disabled, so tab passes it by and lands on Decline: enter here
    // must not be an accept.
    t.press('tab');
    await t.settle();
    expect(t.getByRole('button', { name: 'Decline' }).focused).toBe(true);
    t.press('shift+tab');
    await t.settle();
    t.press('space');
    await t.settle();
    expect(t.hasText('still to answer')).toBe(false);
    t.press('tab');
    await t.settle();
    expect(t.getByRole('button', { name: 'Send' }).focused).toBe(true);
    t.press('enter');
    await t.settle();
    expect(seen.answered).toEqual([{ answers: { 'q-boolean': { kind: 'boolean', value: true } }, accepted: true }]);
    await t.unmount();
  });

  it('declines with no answers', async () => {
    const { t, seen } = await open(ASK([question('text')]));
    const decline = t.getByRole('button', { name: 'Decline' }).rect;
    if (!decline) throw new Error('no decline button');
    t.click(decline.x, decline.y);
    await t.settle();
    expect(seen.answered).toEqual([{ answers: {}, accepted: false }]);
    await t.unmount();
  });
});

describe('the status row', () => {
  const row = async (status: { state: 'sending' | 'failed'; text: string } | null): Promise<Harness> => {
    const t = await renderApp({ width: 40, height: 3, root: h(ChatInputStatus, { status }) });
    await t.settle();
    return t;
  };

  it('is no row when there is nothing to say', async () => {
    const t = await row(null);
    expect(t.text().trim()).toBe('');
    await t.unmount();
  });

  it('says the answer has gone, and says so when it did not', async () => {
    const sending = await row({ state: 'sending', text: 'sending your answer' });
    expect(sending.hasText('sending your answer')).toBe(true);
    await sending.unmount();

    const failed = await row({ state: 'failed', text: 'the host did not take it' });
    expect(failed.hasText('the host did not take it')).toBe(true);
    await failed.unmount();
  });
});
