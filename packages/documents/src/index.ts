import type { Disposable, TextUIApp } from '@textui/core';
import { createBag } from '@textui/core';
import { RESOURCE_COMPONENTS } from './components/resource.js';
import { EDITOR_COMPONENTS } from './components/editor.js';

/**
 * Documents.
 *
 * A buffer is an application's idea of a file: the content a viewer shows, the
 * thing an action transforms, and the thing `save` writes back through a
 * provider. That is a model of a domain, not a way of drawing a frame, which
 * is why it is here and not in the runtime.
 *
 * The resource *registry* stays in core - deciding which component renders a
 * kind is the same late binding as the component registry. What lives here is
 * everything that has an opinion about content: the buffers, the viewers that
 * show them, and the adapters that classify them.
 */

export {
  DOCUMENTS_ROOT, documentPath, getDocument, isDocumentDirty, openDocuments,
  openDocument, setDocumentContent, revertDocument, closeDocument, saveDocument,
  undoDocument, redoDocument, canUndoDocument, canRedoDocument, closeDocumentEdit,
} from './documents.js';
export type { DocumentState, EditOptions } from './documents.js';

export {
  EMPTY_HISTORY, HISTORY_LIMIT, canRedo, canUndo, record, redo, undo,
} from './history.js';
export type { DocumentCursor, History, Snapshot } from './history.js';

export { useDocument } from './use-document.js';
export type { DocumentHandle } from './use-document.js';

export * from './components/resource.js';
export * from './components/json.js';
export * from './components/editor.js';

export {
  jsonAdapter, jsonHighlighter, scanJson, formatJson, minifyJson, sortJsonKeys,
  validateJson, ACTIVE_RESOURCE_PATH,
} from './adapters/json.js';
export type { JsonAdapterOptions, JsonFormatOptions, JsonProblem } from './adapters/json.js';

/**
 * Register the resource viewers.
 *
 * `registerBuiltins` no longer brings these: an application that never opens a
 * resource should not carry a viewer for one. Call this when it does.
 */
export function registerDocuments(app: TextUIApp): Disposable {
  const bag = createBag();
  bag.add(app.components.registerMany(RESOURCE_COMPONENTS));
  bag.add(app.components.registerMany(EDITOR_COMPONENTS));
  return bag;
}
