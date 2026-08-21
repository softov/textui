import type { TaskState } from '@textui/core';
import { useEffect, useRuntime, useStoreValue, useTask } from '@textui/core';
import {
  closeDocumentEdit, documentPath, openDocument, redoDocument, revertDocument,
  saveDocument, setDocumentContent, undoDocument,
  type DocumentState, type EditOptions,
} from './documents.js';
import { canRedo, canUndo, EMPTY_HISTORY } from './history.js';
import type { DocumentCursor, Snapshot } from './history.js';

/**
 * The document hook.
 *
 * It lives beside the buffer model rather than in the runtime, because a
 * buffer is an application's idea of a file - content, dirtiness, and a save
 * that goes back through a provider - and none of that is something a terminal
 * UI runtime needs to know to draw a frame.
 */

export interface DocumentHandle {
  uri: string | null;
  /** What to show. The buffer's content, not necessarily the file's. */
  content: string;
  original: string;
  dirty: boolean;
  readonly: boolean;
  kind: string | undefined;
  status: TaskState['status'];
  error: unknown;
  /** Replace the buffer. What an action like "format" calls. */
  set(content: string, options?: EditOptions): void;
  revert(): void;
  reload(): void;
  save(): Promise<void>;
  canUndo: boolean;
  canRedo: boolean;
  /** Step back, and say where the caret belongs afterwards. */
  undo(cursor?: DocumentCursor): Snapshot | null;
  redo(cursor?: DocumentCursor): Snapshot | null;
  /** End the run of edits folding into one step. Moving the caret ends it. */
  closeEdit(): void;
}

/**
 * Open a resource as an editable buffer.
 *
 * The difference from `useResourceUri` is that this can be changed: an action
 * that formats or minifies writes to the buffer, every viewer showing that URI
 * updates, and nothing has touched the provider until `save`.
 */
export function useDocument(uri: string | null): DocumentHandle {
  const runtime = useRuntime();
  const app = runtime.app();
  const path = documentPath(uri ?? '\u0000');
  const doc = useStoreValue<DocumentState>(path);

  const task = useTask(async () => {
    if (!uri || !app) return null;
    return openDocument(app, uri);
  }, [uri]);

  useEffect(() => {
    if (uri && app && !doc) void task.run();
  }, [uri]);

  const content = doc?.content ?? '';
  return {
    uri,
    content,
    original: doc?.original ?? '',
    dirty: doc !== undefined && doc.content !== doc.original,
    readonly: doc?.readonly ?? true,
    kind: doc?.kind,
    status: doc ? 'success' : task.status,
    error: task.error,
    set: (next: string, options?: EditOptions) => {
      if (uri) setDocumentContent(runtime.store, uri, next, options);
    },
    // Read off the value this component is already subscribed to, so a menu
    // row that asks whether undo is possible redraws when it stops being.
    canUndo: canUndo(doc?.history ?? EMPTY_HISTORY),
    canRedo: canRedo(doc?.history ?? EMPTY_HISTORY),
    undo: (cursor?: DocumentCursor) => (uri ? undoDocument(runtime.store, uri, cursor) : null),
    redo: (cursor?: DocumentCursor) => (uri ? redoDocument(runtime.store, uri, cursor) : null),
    closeEdit: () => {
      if (uri) closeDocumentEdit(runtime.store, uri);
    },
    revert: () => {
      if (uri) revertDocument(runtime.store, uri);
    },
    reload: () => {
      if (uri && app) void openDocument(app, uri, { reload: true });
    },
    save: async () => {
      if (uri && app) await saveDocument(app, uri);
    },
  };
}
