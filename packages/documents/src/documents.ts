import type { BindingPath } from '@textui/core';
import type { ReactiveStore } from '@textui/core';
import type { TextUIApp } from '@textui/core';
import { escapeSegment } from '@textui/core';
import {
  EMPTY_HISTORY, canRedo, canUndo, record, redo, undo,
  type DocumentCursor, type History, type Snapshot,
} from './history.js';

/**
 * Document buffers.
 *
 * A viewer that reads straight from a provider can only ever show what is on
 * disk, which makes "format this file" either a write or a lie. A buffer is
 * the third option: the content a viewer shows, the thing an action
 * transforms, and the thing `save` writes back - so formatting a file from a
 * read-only provider does something visible and honest instead of failing.
 *
 * Buffers live in the session scope, so they die with the process and never
 * outlive the terminal they were opened in.
 */

export const DOCUMENTS_ROOT = '$/session/documents';

export interface DocumentState {
  uri: string;
  /** What the viewer shows and an action transforms. */
  content: string;
  /** What was read from the provider. `dirty` is the difference. */
  original: string;
  kind?: string;
  /** True when the provider cannot take it back. */
  readonly: boolean;
  /**
   * Undo lives with the buffer, not with whatever is showing it.
   *
   * Two editors on one file share a history because they share the text; and
   * an action that reformats the whole document is one step back, the same as
   * a keystroke is. A history kept in a component would lose both, and lose
   * everything the moment the pane closed.
   */
  history: History;
}

/** Where one document lives. The URI is a single escaped segment. */
export function documentPath(uri: string): BindingPath {
  return `${DOCUMENTS_ROOT}/${escapeSegment(uri)}` as BindingPath;
}

export function getDocument(store: ReactiveStore, uri: string): DocumentState | undefined {
  return store.get<DocumentState>(documentPath(uri));
}

export function isDocumentDirty(store: ReactiveStore, uri: string): boolean {
  const doc = getDocument(store, uri);
  return doc !== undefined && doc.content !== doc.original;
}

/** List every open buffer. The explorer's "unsaved changes" answer. */
export function openDocuments(store: ReactiveStore): DocumentState[] {
  const all = store.get<Record<string, DocumentState>>(DOCUMENTS_ROOT as BindingPath);
  return all ? Object.values(all) : [];
}

/**
 * Read a resource into a buffer, or return the buffer already open for it.
 *
 * Already-open wins deliberately: re-reading would throw away an edit the user
 * can see on screen.
 */
export async function openDocument(
  app: TextUIApp,
  uri: string,
  options: { reload?: boolean } = {},
): Promise<DocumentState> {
  const existing = getDocument(app.store, uri);
  if (existing && !options.reload) return existing;

  const resource = await app.resources.stat(uri);
  const raw = await app.resources.read(uri);
  const content = typeof raw === 'string' ? raw : new TextDecoder().decode(raw);

  const doc: DocumentState = {
    uri,
    content,
    original: content,
    history: EMPTY_HISTORY,
    kind: resource?.kind,
    readonly:
      resource?.metadata.readonly === true ||
      !(resource?.capabilities.includes('write') ?? false),
  };
  app.store.set(documentPath(uri), doc);
  return doc;
}

export interface EditOptions {
  /** Where the caret was before this edit, so undo can put it back. */
  cursor?: DocumentCursor;
  /**
   * Fold into the previous edit when it named the same kind.
   *
   * Typing a word is one thing that happened. Leave it off - as an action
   * that rewrites the whole file should - and the edit is its own step.
   */
  coalesce?: string;
  /** Skip the history entirely. Undo and redo use this to move the stacks. */
  history?: false;
}

/** Replace a buffer's content. Does nothing when nothing is open. */
export function setDocumentContent(
  store: ReactiveStore,
  uri: string,
  content: string,
  options: EditOptions = {},
): DocumentState | undefined {
  const doc = getDocument(store, uri);
  if (!doc) return undefined;
  if (doc.content === content) return doc;

  const history = options.history === false
    ? historyOf(doc)
    : record(
      historyOf(doc),
      { content: doc.content, ...(options.cursor ? { cursor: options.cursor } : {}) },
      options.coalesce ?? null,
    );

  const next: DocumentState = { ...doc, content, history };
  store.set(documentPath(uri), next);
  return next;
}

/**
 * Throw away edits and go back to what was read.
 *
 * Recorded, because reverting a file by accident is exactly the moment
 * somebody wants a step back, and it is one edit however many it undoes.
 */
export function revertDocument(store: ReactiveStore, uri: string): void {
  const doc = getDocument(store, uri);
  if (!doc) return;
  setDocumentContent(store, uri, doc.original);
}

/** A buffer opened before this existed still has to answer. */
function historyOf(doc: DocumentState): History {
  return doc.history ?? EMPTY_HISTORY;
}

/**
 * End the run of edits that is folding into one step.
 *
 * Moving the caret is the boundary nobody thinks about: type `abc`, move left,
 * type `d`, and without this the `d` folds into the same entry as `abc` - so
 * one undo takes back a word you typed in two different places.
 */
export function closeDocumentEdit(store: ReactiveStore, uri: string): void {
  const doc = getDocument(store, uri);
  if (!doc || historyOf(doc).open === null) return;
  store.set(documentPath(uri), { ...doc, history: { ...historyOf(doc), open: null } });
}

export function canUndoDocument(store: ReactiveStore, uri: string): boolean {
  const doc = getDocument(store, uri);
  return doc !== undefined && canUndo(historyOf(doc));
}

export function canRedoDocument(store: ReactiveStore, uri: string): boolean {
  const doc = getDocument(store, uri);
  return doc !== undefined && canRedo(historyOf(doc));
}

/**
 * Step the buffer back, and say where the caret belongs.
 *
 * The caller passes where the caret is now so the step forward can return to
 * it. An editor knows that; the document does not, and should not.
 */
export function undoDocument(
  store: ReactiveStore,
  uri: string,
  cursor?: DocumentCursor,
): Snapshot | null {
  return step(store, uri, cursor, undo);
}

export function redoDocument(
  store: ReactiveStore,
  uri: string,
  cursor?: DocumentCursor,
): Snapshot | null {
  return step(store, uri, cursor, redo);
}

function step(
  store: ReactiveStore,
  uri: string,
  cursor: DocumentCursor | undefined,
  move: (history: History, current: Snapshot) => { history: History; to: Snapshot } | null,
): Snapshot | null {
  const doc = getDocument(store, uri);
  if (!doc) return null;

  const current: Snapshot = { content: doc.content, ...(cursor ? { cursor } : {}) };
  const stepped = move(historyOf(doc), current);
  if (!stepped) return null;

  store.set(documentPath(uri), {
    ...doc,
    content: stepped.to.content,
    history: stepped.history,
  });
  return stepped.to;
}

export function closeDocument(store: ReactiveStore, uri: string): void {
  store.delete(documentPath(uri));
}

/**
 * Write the buffer back through its provider. The buffer stays open, with its
 * baseline moved forward, because saving is not closing.
 */
export async function saveDocument(app: TextUIApp, uri: string): Promise<void> {
  const doc = getDocument(app.store, uri);
  if (!doc) throw new Error(`[textui] no document open for ${uri}`);
  if (doc.readonly) throw new Error(`[textui] ${uri} is read-only`);

  await app.resources.write(uri, doc.content);
  app.store.set(documentPath(uri), { ...doc, original: doc.content });
}
