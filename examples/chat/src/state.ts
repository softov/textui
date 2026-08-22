import type { BindingPath, ReactiveStore } from '@textui/core';
import type { HostEvent } from './ahp/connection.js';
import type { Changeset, PendingInput, SessionSummary, SessionUri, Turn } from './ahp/types.js';
import { byUrgency, decodeStatus } from './ahp/status.js';

/**
 * Where the conversation lives, and how the host's actions get there.
 *
 * The store is the only state. Everything the host says is folded in here, and
 * every screen reads it back out - so the transcript, the sessions list, the
 * status bar and the composer are all looking at one answer to "what is
 * happening", and a turn that finishes updates all four without any of them
 * knowing the others exist.
 *
 * Nothing in this file renders. That is the whole point of it being a file.
 */

export const HOST = '$/chat/host' as BindingPath;
export const SESSIONS = '$/chat/sessions' as BindingPath;

/** The open conversation. One at a time, so it is not keyed by session. */
export const TURNS = '$/chat/conv/turns' as BindingPath;
export const INPUT = '$/chat/conv/input' as BindingPath;
export const CHANGES = '$/chat/conv/changes' as BindingPath;
export const STATUS = '$/chat/conv/status' as BindingPath;
/**
 * Is there a turn to stop, as a `when` clause can ask it.
 *
 * The status is a bitset carrying client flags as well as activity - an idle
 * session that has been read is 33 - so "status > 1" is not "something is
 * happening", it is "something is happening, or somebody looked at it". The
 * decoding belongs in one place, and a clause cannot call it, so the answer is
 * written beside the number.
 */
export const RUNNING = '$/chat/conv/running' as BindingPath;

/**
 * What the next message will be sent as.
 *
 * Not a session's state, and deliberately not keyed by session: it is the
 * composer's own row of choices, which exists before there is a session to
 * hang them on. Sending is what turns them into one - a `createSession` with
 * the harness and the workspace, and a `chat/turnStarted` carrying the model,
 * because AHP hangs the model on the message rather than on the session.
 */
export const PROVIDER = '$/chat/compose/provider' as BindingPath;
export const MODEL = '$/chat/compose/model' as BindingPath;
export const PERMISSIONS = '$/chat/compose/permissions' as BindingPath;
export const WORKSPACE = '$/chat/compose/workspace' as BindingPath;

/** What the host last refused, in the host's own words. Cleared by success. */
export const HOST_ERROR = '$/chat/host/error' as BindingPath;

export const OPEN = '$/chat/ui/open' as BindingPath;
/** The catalogue's highlight. What a session command acts on when none is open. */
export const SELECTED = '$/chat/ui/selected' as BindingPath;
export const DRAFT = '$/chat/ui/draft' as BindingPath;
export const QUEUE = '$/chat/ui/queue' as BindingPath;
export const HISTORY = '$/chat/ui/history' as BindingPath;
export const FILTER = '$/chat/ui/filter' as BindingPath;
export const ARCHIVED = '$/chat/ui/archived' as BindingPath;
export const EXPANDED = '$/chat/ui/expanded' as BindingPath;

/**
 * The runtime's own state, read rather than asked for.
 *
 * `screens.current()` and `focus.focused()` are method calls: correct at the
 * moment they run and attached to nothing. A surface that survives navigating -
 * which is the whole point of a surface - has to subscribe instead, or it
 * keeps the chrome of the screen you left.
 */
export const SCREEN = '$/layout/screen/current' as BindingPath;
export const FOCUS = '$/focus/id' as BindingPath;

export interface HostState {
  id: string;
  url: string;
  state: 'connecting' | 'connected' | 'offline';
}

// -------------------------------------------------------------------- writing

/**
 * Fold one thing the host said into the store.
 *
 * A delta is a word, so this runs per word during a turn. It writes the whole
 * turn list because the store is addressed by path and a mutation in place is
 * a change nothing can see - a real client debounces the write, which is a
 * change here and nowhere above.
 */
export function applyEvent(store: ReactiveStore, event: HostEvent, model: Turn[]): Turn[] {
  switch (event.type) {
    case 'snapshot': {
      const next = [...event.turns, ...(event.active ? [event.active] : [])];
      writeTurns(store, next);
      store.set(INPUT, event.input ?? null);
      writeStatus(store, event.status);
      // A snapshot arrived, so whatever the host last refused is not what is
      // on screen any more.
      store.set(HOST_ERROR, null);
      return next;
    }
    case 'turnStarted': {
      const next = [...model.filter((t) => t.id !== event.turn.id), event.turn];
      writeTurns(store, next);
      return next;
    }
    case 'delta':
    case 'toolCall':
      // The part was mutated on the turn the model already holds; the write is
      // what makes it visible. Rebuilding the list is what changes identity.
      writeTurns(store, model);
      return model;
    case 'turnComplete': {
      const next = model.map((turn) => (turn.id === event.turn.id ? event.turn : turn));
      writeTurns(store, next);
      return next;
    }
    case 'inputNeeded':
      store.set(INPUT, event.input);
      return model;
    case 'inputResolved':
      store.set(INPUT, null);
      return model;
    case 'status':
      writeStatus(store, event.status);
      return model;
    case 'error':
      store.set(HOST_ERROR, event.message);
      return model;
    case 'changes':
      store.set(CHANGES, event.changes);
      return model;
    default:
      return model;
  }
}

/** The number, and the one question everything else asks of it. */
export function writeStatus(store: ReactiveStore, status: number): void {
  const activity = decodeStatus(status).activity;
  store.set(STATUS, status);
  store.set(RUNNING, activity === 'running' || activity === 'input');
}

/** A new array every time, and new part arrays inside it, or nothing redraws. */
function writeTurns(store: ReactiveStore, turns: Turn[]): void {
  store.set(TURNS, turns.map((turn) => ({ ...turn, parts: [...turn.parts] })));
}

export function writeSessions(store: ReactiveStore, sessions: SessionSummary[]): void {
  const byUri: Record<string, SessionSummary> = {};
  for (const session of sessions) byUri[session.resource] = session;
  store.set(SESSIONS, byUri);
}

// -------------------------------------------------------------------- reading

export function sessions(store: ReactiveStore): SessionSummary[] {
  const byUri = store.get<Record<string, SessionSummary>>(SESSIONS) ?? {};
  return Object.values(byUri);
}

/**
 * The catalogue as the list shows it.
 *
 * Archived is hidden rather than filtered out of existence: a session somebody
 * put away is still a session, and the count of what is hidden is what tells
 * the reader the list is not everything.
 */
export function visibleSessions(store: ReactiveStore): SessionSummary[] {
  const query = (store.get<string>(FILTER) ?? '').trim().toLowerCase();
  const showArchived = store.get<boolean>(ARCHIVED) ?? false;
  return sessions(store)
    .filter((session) => showArchived || !decodeStatus(session.status).archived)
    .filter((session) => query === ''
      || session.title.toLowerCase().includes(query)
      || session.provider.includes(query)
      || session.workingDirectories.some((dir) => dir.toLowerCase().includes(query)))
    .sort(byUrgency);
}

export function openSession(store: ReactiveStore): SessionSummary | null {
  const uri = store.get<SessionUri>(OPEN);
  if (!uri) return null;
  return (store.get<Record<string, SessionSummary>>(SESSIONS) ?? {})[uri] ?? null;
}

export function turns(store: ReactiveStore): Turn[] {
  return store.get<Turn[]>(TURNS) ?? [];
}

export function pendingInput(store: ReactiveStore): PendingInput | null {
  return store.get<PendingInput>(INPUT) ?? null;
}

export function changes(store: ReactiveStore): Changeset {
  return store.get<Changeset>(CHANGES) ?? { status: 'complete', files: [] };
}

/** The running turn, if there is one. Never in the history until it finishes. */
export function activeTurn(store: ReactiveStore): Turn | null {
  return turns(store).find((turn) => turn.state === 'running') ?? null;
}

export function queue(store: ReactiveStore): string[] {
  return store.get<string[]>(QUEUE) ?? [];
}

/** A short name for a `file://` working directory. */
export function workspaceName(uri: string | undefined): string {
  if (!uri) return 'no workspace';
  return uri.replace(/^file:\/\//, '').split('/').filter(Boolean).pop() ?? '/';
}
