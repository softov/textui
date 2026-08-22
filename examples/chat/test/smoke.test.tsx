import { describe, expect, it } from 'vitest';
import { renderApp } from '@textui/testing';
import type { Harness } from '@textui/testing';
import { registerChat } from '../src/app.js';
import { CONTROLLER } from '../src/control.js';
import { fakeHost } from '../src/ahp/fake.js';
import type { FakeHost } from '../src/ahp/fake.js';
import { decodeStatus } from '../src/ahp/status.js';
import { SessionFlag } from '../src/ahp/types.js';
import { layoutMarkdown, wrapRuns } from '@textui/core';
import { toBlocks } from '../src/blocks.js';
import { INPUT, QUEUE, TURNS } from '../src/state.js';
import type { Turn } from '../src/ahp/types.js';

/**
 * The example, mounted.
 *
 * What is worth checking is what a screenshot cannot tell you: that a turn
 * arriving one word at a time is one growing bubble rather than a new one per
 * word, that a blocked agent is answerable, that a question is not rendered as
 * a confirmation, and that a letter typed into the composer is a letter.
 *
 * Time is the host's `pump`, so none of this waits on a clock.
 */

const SIZES = [
  { width: 100, height: 30 },
  { width: 76, height: 20 },
];

const SEEDED = 'ahp-session:/1f0a';
const IDLE = 'ahp-session:/9c74';

interface Mounted { t: Harness; host: FakeHost }

async function open(size = SIZES[0] as { width: number; height: number }): Promise<Mounted> {
  const host = fakeHost();
  const t = await renderApp({
    ...size,
    shell: 'workbench',
    theme: 'workbench',
    onBoot: (app) => { registerChat(app, { host }); },
  });
  for (let i = 0; i < 8; i++) await t.settle();
  return { t, host };
}

/** Run the script to where it needs an answer, rendering as it goes. */
async function run(m: Mounted, steps = 100_000): Promise<void> {
  for (let i = 0; i < steps; i++) if (!m.host.pump()) break;
  for (let i = 0; i < 6; i++) await m.t.settle();
}

async function conversation(size?: { width: number; height: number }): Promise<Mounted> {
  const m = await open(size);
  m.t.app.services.require(CONTROLLER).open(SEEDED);
  m.t.app.screens.push('chat');
  for (let i = 0; i < 6; i++) await m.t.settle();
  return m;
}

describe.each(SIZES.map((s) => [`${s.width}x${s.height}`, s] as const))('at %s', (_name, size) => {
  it('opens on the catalogue, urgent first', async () => {
    const { t } = await open(size);
    expect(t.app.screens.current()?.id).toBe('sessions');
    // The session waiting on a person is the first row, whatever it was
    // called or when it last moved.
    expect(t.hasText('Kqueue events on Linux')).toBe(true);
    await t.unmount();
  });

  it('draws every row inside the frame it was given', async () => {
    const { t } = await conversation(size);
    expect(t.lines().every((line) => line.length <= size.width)).toBe(true);
    await t.unmount();
  });
});

describe('the transcript', () => {
  it('renders a conversation from a snapshot, not only from deltas', async () => {
    const { t } = await conversation();
    expect(t.hasText('EVFILT_FS never fires')).toBe(true);
    // The prose is in `content`, not `markdown` or `text`. Reading the wrong
    // field costs every word the agent said and nothing else.
    expect(t.hasText('libkqueue')).toBe(true);
    // And the tool call is a row of its own, never rendered as text.
    expect(t.hasText('Search')).toBe(true);
    await t.unmount();
  });

  it('grows one bubble as the words arrive', async () => {
    const m = await conversation();
    m.t.app.services.require(CONTROLLER).send('Why does q quit while I am typing?');
    await run(m, 40);

    const turns = m.t.store.get<Turn[]>(TURNS) ?? [];
    const running = turns.filter((turn) => turn.state === 'running');
    // One running turn, whatever number of deltas landed in it. The running
    // turn is `activeTurn` and is not in the history until it finishes.
    expect(running).toHaveLength(1);
    expect(m.t.hasText('Two things')).toBe(true);
    await m.t.unmount();
  });

  it('expands a tool call in place', async () => {
    const m = await conversation();
    // The call's output is not on screen until it is asked for.
    expect(m.t.hasText('#define EVFILT_FS')).toBe(false);
    m.t.app.store.set('$/chat/ui/expanded', { c1: true });
    for (let i = 0; i < 4; i++) await m.t.settle();
    expect(m.t.hasText('#define EVFILT_FS')).toBe(true);
    await m.t.unmount();
  });
});

describe('when the agent is waiting', () => {
  it('blocks on a tool confirmation and answers it', async () => {
    const m = await conversation();
    m.t.app.services.require(CONTROLLER).send('run the tests');
    await run(m);

    // `InputNeeded` is 24 and carries `InProgress`: a client that tests the
    // wrong one first reports this session as merely running.
    const status = m.t.store.get<number>('$/chat/conv/status') ?? 0;
    expect(decodeStatus(status).activity).toBe('input');
    expect(m.t.hasText('Run a command in')).toBe(true);
    expect(m.t.hasText('Approve')).toBe(true);

    m.t.app.services.require(CONTROLLER).approve();
    await run(m, 1);
    expect(m.t.store.get(INPUT)).toBeNull();
    await m.t.unmount();
  });

  it('renders a question as a question, with its choices', async () => {
    const m = await conversation();
    const controller = m.t.app.services.require(CONTROLLER);
    controller.send('run the tests');
    await run(m);
    controller.approve();
    await run(m);

    // A `chatInput` carries no tool call at all. Read as a confirmation, the
    // options vanish and what is left is a heading and an Approve button.
    expect(m.t.hasText('Where should the single-letter keys')).toBe(true);
    expect(m.t.hasText('1. On the transcript scope')).toBe(true);
    expect(m.t.hasText('Add a test that types into the composer')).toBe(true);
    await m.t.unmount();
  });

  it('will not send while a required question is unanswered', async () => {
    const m = await conversation();
    const controller = m.t.app.services.require(CONTROLLER);
    controller.send('run the tests');
    await run(m);
    controller.approve();
    await run(m);

    // An accept with no answers resumes the agent on the answers it already
    // had, which for a question it has just asked is none.
    controller.answer({}, true);
    await run(m, 1);
    expect(m.t.store.get(INPUT)).not.toBeNull();

    controller.answer({ q1: { kind: 'selected', value: 'transcript-scope' } }, true);
    await run(m);
    expect(m.t.store.get(INPUT)).toBeNull();
    expect(m.t.hasText('transcript-scope')).toBe(true);
    await m.t.unmount();
  });
});

describe('the composer', () => {
  it('takes a letter that is also a command key', async () => {
    const m = await conversation();
    m.t.focus('chat.composer');
    await m.t.settle();

    // `c` opens the changes screen while the transcript has the keyboard. In
    // the composer it is a letter, because the focused node is offered a key
    // before any keybinding is.
    m.t.type('check');
    for (let i = 0; i < 4; i++) await m.t.settle();

    expect(m.t.app.screens.current()?.id).toBe('chat');
    expect(m.t.store.get<string>('$/chat/ui/draft')).toBe('check');
    await m.t.unmount();
  });

  it('queues a message rather than starting a second turn', async () => {
    const m = await conversation();
    const controller = m.t.app.services.require(CONTROLLER);
    controller.send('first');
    await run(m, 6);

    controller.send('and another thing');
    await m.t.settle();

    expect(m.t.store.get<string[]>(QUEUE)).toEqual(['and another thing']);
    const running = (m.t.store.get<Turn[]>(TURNS) ?? []).filter((turn) => turn.state === 'running');
    expect(running).toHaveLength(1);
    expect(m.t.hasText('queued')).toBe(true);
    await m.t.unmount();
  });

  it('sends on enter, from bytes rather than a synthesised event', async () => {
    const m = await open();
    m.t.app.services.require(CONTROLLER).open(IDLE);
    m.t.app.screens.push('chat');
    for (let i = 0; i < 6; i++) await m.t.settle();

    m.t.focus('chat.composer');
    m.t.type('hello');
    m.t.feed('\r');
    for (let i = 0; i < 4; i++) await m.t.settle();

    expect(m.t.store.get<string>('$/chat/ui/draft')).toBe('');
    await run(m, 3);
    expect(m.t.hasText('hello')).toBe(true);
    await m.t.unmount();
  });
});

describe('the catalogue', () => {
  it('puts the keyboard on the list, not in the filter', async () => {
    const { t } = await open();
    // Every single-letter command depends on this. With focus in the filter,
    // `d` is a letter typed into a text field and the key that disposes a
    // session does nothing - which looks exactly like a key that is missing.
    expect(t.app.focus.focused()).toBe('chat.sessions');
    await t.unmount();
  });

  it('archives the selected session with a key', async () => {
    const { t } = await open();
    t.app.store.set('$/chat/ui/selected', 'ahp-session:/9c74');
    await t.settle();

    t.press('a');
    for (let i = 0; i < 4; i++) await t.settle();
    // Archived is hidden, so the row leaves the list it was in.
    expect(t.hasText('Why does the composer')).toBe(false);
    await t.unmount();
  });

  it('disposes a session after asking', async () => {
    const { t } = await open();
    t.app.store.set('$/chat/ui/selected', 'ahp-session:/9c74');
    await t.settle();

    t.press('d');
    for (let i = 0; i < 4; i++) await t.settle();
    // The host ends the session for every client watching it, so it asks.
    expect(t.hasText('Dispose session')).toBe(true);

    t.press('enter');
    for (let i = 0; i < 6; i++) await t.settle();
    expect(t.hasText('Why does the composer')).toBe(false);
    await t.unmount();
  });

  it('focuses the filter by name, which is what a key needs to exist', async () => {
    const { t } = await open();
    await t.app.execute('session.filter');
    await t.settle();
    expect(t.app.focus.focused()).toBe('chat.filter');

    // And typing into it is typing, not commands: `n` would be "new session"
    // one control away.
    t.type('never');
    for (let i = 0; i < 4; i++) await t.settle();
    expect(t.app.screens.current()?.id).toBe('sessions');
    expect(t.store.get<string>('$/chat/ui/filter')).toBe('never');
    await t.unmount();
  });

  it('hides archived sessions, and says so', async () => {
    const { t } = await open();
    expect(t.hasText('Old build script')).toBe(false);
    await t.app.execute('session.toggleArchived');
    for (let i = 0; i < 4; i++) await t.settle();
    expect(t.hasText('Old build script')).toBe(true);
    await t.unmount();
  });
});

describe('leaving', () => {
  it('gives ctrl+c to the turn while one is running, and to quit when none is', async () => {
    const quits: string[] = [];
    const host = fakeHost();
    const t = await renderApp({
      width: 100,
      height: 30,
      shell: 'workbench',
      theme: 'workbench',
      onBoot: (app) => {
        registerChat(app, { host });
        app.commands.register({ id: 'app.quit', title: 'Quit', run: () => quits.push('quit') });
        app.keybindings.register({ keys: 'ctrl+c', commandId: 'app.quit' });
      },
    });
    for (let i = 0; i < 6; i++) await t.settle();

    // Nothing is running: the stop binding does not apply and the key falls
    // through. A `when` on the command alone would swallow it here.
    t.press('ctrl+c');
    await t.settle();
    expect(quits).toEqual(['quit']);

    const controller = t.app.services.require(CONTROLLER);
    controller.open(SEEDED);
    t.app.screens.push('chat');
    for (let i = 0; i < 4; i++) await t.settle();
    controller.send('go');
    for (let i = 0; i < 20; i++) host.pump();
    for (let i = 0; i < 4; i++) await t.settle();

    t.press('ctrl+c');
    for (let i = 0; i < 4; i++) await t.settle();
    // Still one: this one stopped the turn instead.
    expect(quits).toEqual(['quit']);
    expect(t.store.get<Turn[]>(TURNS)?.some((turn) => turn.state === 'running')).toBe(false);
    await t.unmount();
  });
});

describe('on a terminal that can only do ASCII', () => {
  it('draws nothing that terminal cannot draw', async () => {
    const host = fakeHost();
    const t = await renderApp({
      width: 100,
      height: 30,
      shell: 'workbench',
      theme: 'workbench',
      capabilities: { unicode: 'ascii', wideChars: false },
      onBoot: (app) => { registerChat(app, { host }); },
    });
    t.app.services.require(CONTROLLER).open(SEEDED);
    t.app.screens.push('chat');
    for (let i = 0; i < 8; i++) await t.settle();

    const offending = [...new Set([...t.text()].filter((c) => (c.codePointAt(0) as number) > 0x7f))];
    expect(offending).toEqual([]);
    await t.unmount();
  });
});

// The pure parts, checked without a terminal at all.

describe('status is two things in one number', () => {
  it('reads InputNeeded before InProgress', () => {
    expect(decodeStatus(SessionFlag.InputNeeded).activity).toBe('input');
    expect(decodeStatus(40).activity).toBe('running');
    expect(decodeStatus(33)).toMatchObject({ activity: 'idle', read: true });
    expect(decodeStatus(65)).toMatchObject({ activity: 'idle', archived: true });
  });
});

describe('markdown', () => {
  it('keeps a fence that has not been closed yet', () => {
    // A turn is streamed. The closing fence may simply not have been said, and
    // a block that flickers between prose and code as the words land is worse
    // than one shown open.
    const rows = layoutMarkdown('here:\n```sh\nmake -f Makefile.linux', { width: 40 });
    expect(rows.map((row) => row.kind)).toEqual(['text', 'fence', 'fence', 'fence']);
  });

  it('wraps styled runs on cells, keeping the styles', () => {
    const lines = wrapRuns([{ text: 'one ' }, { text: 'two', bold: true }, { text: ' three' }], 8);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.flat().some((run) => run.bold)).toBe(true);
  });

  it('keeps the emphasis a document viewer used to strip', () => {
    const [row] = layoutMarkdown('the **composer** owns `enter`', { width: 60 });
    const runs = row?.kind === 'text' ? row.runs : [];
    expect(runs.some((run) => run.bold && run.text === 'composer')).toBe(true);
    expect(runs.some((run) => run.code && run.text === 'enter')).toBe(true);
  });
});

describe('blocks', () => {
  it('keeps prose and tool calls in the order the host sent them', () => {
    const turn: Turn = {
      id: 't', role: 'agent', state: 'complete', at: '', parts: [
        { kind: 'markdown', id: 'm1', content: 'let me look' },
        { kind: 'toolCall', id: 'c1', call: { id: 'c1', name: 'Read', toolName: 'Read', status: 'completed' } },
        { kind: 'markdown', id: 'm2', content: 'found it' },
      ],
    };
    expect(toBlocks([turn]).map((block: { kind: string }) => block.kind))
      .toEqual(['header', 'prose', 'tool', 'prose']);
  });
});
