import { describe, expect, it } from 'vitest';
import { h } from '@textui/core';
import { renderApp } from '@textui/testing';
import type { Harness } from '@textui/testing';
import { ChatSessionHead, ConnectionBadge, SessionList } from '../src/index.js';
import type { ChatSession } from '../src/index.js';

/**
 * The catalogue and the head over a conversation.
 *
 * Both take a session that is already decoded - the status is a word, a tone
 * and a glyph, the project and the branch are strings - so what is checked is
 * that everything a row is given ends up on it, and that the row is known by
 * the session's own id.
 */

const SESSION: ChatSession = {
  id: 'ahp-session://one',
  title: 'Rename the widgets package',
  provider: 'claude',
  status: { activity: 'running', archived: false, read: true, label: 'running', tone: 'accent', glyph: 'bulletFilled' },
  createdAt: '2026-09-16T08:00:00Z',
  modifiedAt: '2026-09-16T09:30:00Z',
  workingDirectories: ['file:///home/me/textui'],
  project: 'textui',
  branch: 'chat-package',
  activity: 'reading tests',
  origin: 'by an automation',
  changes: { files: 3, additions: 12, deletions: 4 },
};

const list = async (props: Record<string, unknown> = {}, width = 80): Promise<Harness> => {
  const t = await renderApp({
    width,
    height: 12,
    theme: 'workbench',
    root: h(SessionList, { sessions: [SESSION], autoFocus: true, ...props }),
  });
  await t.settle();
  await t.settle();
  return t;
};

describe('the session list', () => {
  it('puts everything it was given on the row', async () => {
    // Wide, because the second line is one truncated line: what is checked
    // here is that everything is on it, not how it is shortened.
    const t = await list({}, 140);
    for (const text of [
      'Rename the widgets package', 'running', 'claude', 'textui chat-package',
      '3 files  +12 -4', 'reading tests', 'by an automation',
    ]) {
      expect(t.hasText(text), text).toBe(true);
    }
    await t.unmount();
  });

  it('puts the pull request after the branch it became', async () => {
    const t = await list({ sessions: [{ ...SESSION, pullRequest: '#412 merged' }] }, 120);
    expect(t.hasText('textui chat-package #412 merged')).toBe(true);
    await t.unmount();
  });

  it('says when a session is archived', async () => {
    const t = await list({ sessions: [{ ...SESSION, status: { ...SESSION.status, archived: true } }] }, 140);
    expect(t.hasText('archived')).toBe(true);
    await t.unmount();
  });

  it('has a message for nothing at all', async () => {
    const t = await list({ sessions: [] });
    expect(t.hasText('No sessions on this host')).toBe(true);
    await t.unmount();
    const own = await list({ sessions: [], emptyMessage: 'Nothing here' });
    expect(own.hasText('Nothing here')).toBe(true);
    await own.unmount();
  });

  it('reports the session id on select and on open', async () => {
    const selected: string[] = [];
    const opened: string[] = [];
    const t = await list({
      sessions: [SESSION, { ...SESSION, id: 'ahp-session://two', title: 'Second' }],
      onSelect: (id: string) => selected.push(id),
      onOpen: (id: string) => opened.push(id),
    });
    t.press('down');
    await t.settle();
    t.press('enter');
    await t.settle();
    expect(selected).toContain('ahp-session://two');
    expect(opened).toEqual(['ahp-session://two']);
    await t.unmount();
  });
});

describe('the connection badge', () => {
  it('shows the host and the count for each state', async () => {
    for (const state of ['connecting', 'connected', 'offline'] as const) {
      const t = await renderApp({
        width: 60,
        height: 3,
        root: h(ConnectionBadge, { url: 'ws://localhost:4020', state, sessions: 2 }),
      });
      await t.settle();
      expect(t.hasText('ws://localhost:4020')).toBe(true);
      expect(t.hasText('2 sessions')).toBe(true);
      await t.unmount();
    }
  });
});

describe('the session head', () => {
  const head = async (props: Record<string, unknown> = {}): Promise<Harness> => {
    const t = await renderApp({
      width: 70,
      height: 14,
      theme: 'workbench',
      root: h(ChatSessionHead, { session: SESSION, ...props }),
    });
    await t.settle();
    return t;
  };

  it('names the session, its state, its harness and where it runs', async () => {
    const t = await head({ model: 'opus', chat: 'ahp-chat://one' });
    for (const text of [
      'Rename the widgets package', 'running', 'claude', 'opus', '/home/me/textui',
      'chat-package', 'ahp-session://one', 'ahp-chat://one',
    ]) {
      expect(t.hasText(text), text).toBe(true);
    }
    expect(t.hasText('file://')).toBe(false);
    await t.unmount();
  });

  it('leaves out the rows it does not know', async () => {
    const { branch: _branch, ...bare } = SESSION;
    const t = await head({ session: bare });
    expect(t.hasText('Branch')).toBe(false);
    expect(t.hasText('Chat')).toBe(false);
    await t.unmount();
  });

  it('lists the others present, and nobody when it is only this client', async () => {
    const alone = await head({ present: [{ clientId: 'me' }] });
    expect(alone.hasText('Here')).toBe(false);
    await alone.unmount();

    const two = await head({ present: [{ clientId: 'me' }, { clientId: 'x', displayName: 'Ada' }] });
    expect(two.hasText('Ada')).toBe(true);
    await two.unmount();
  });
});
