import type { BindingPath } from '../types/graph.js';
import type { ReactiveStore } from '../types/store.js';
import type { TextUIApp } from '../types/app.js';
import { escapeSegment } from '../util/paths.js';

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
    kind: resource?.kind,
    readonly:
      resource?.metadata.readonly === true ||
      !(resource?.capabilities.includes('write') ?? false),
  };
  app.store.set(documentPath(uri), doc);
  return doc;
}

/** Replace a buffer's content. Does nothing when nothing is open. */
export function setDocumentContent(
  store: ReactiveStore,
  uri: string,
  content: string,
): DocumentState | undefined {
  const doc = getDocument(store, uri);
  if (!doc) return undefined;
  if (doc.content === content) return doc;
  const next: DocumentState = { ...doc, content };
  store.set(documentPath(uri), next);
  return next;
}

/** Throw away edits and go back to what was read. */
export function revertDocument(store: ReactiveStore, uri: string): void {
  const doc = getDocument(store, uri);
  if (!doc) return;
  store.set(documentPath(uri), { ...doc, content: doc.original });
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
