import type { BindingPath, ReactiveStore } from '@textui/core';
import { WORKSPACE_PATH, type Workspace } from './workspace.js';

/**
 * The open files, as a list.
 *
 * One view became several the moment there was more than one way to be
 * looking at a file, and the cheapest honest model of that is a list of URIs
 * and a pointer into it. Everything else is derived: the label is the last
 * segment of the URI, the dirty marker is the buffer's, and which pane a file
 * is in is one more URI beside the list rather than a tree of groups.
 *
 * `$/ui/editor/uri` keeps meaning exactly what it meant when there was one
 * view - the file you are looking at - so everything that reads it still
 * works, and writing to it directly still opens a file. The strip reconciles
 * itself against it rather than the other way round, which is what stops
 * "open a file" from having two implementations.
 */

export const EDITOR_URI = '$/ui/editor/uri' as BindingPath;
export const EDITOR_MODE = '$/ui/editor/mode' as BindingPath;
/** How much the editor has selected, for the status bar. */
export const EDITOR_SELECTION = '$/ui/editor/selection' as BindingPath;
/** Every open file, in strip order. */
export const TABS_PATH = '$/ui/editor/tabs' as BindingPath;
/** The URI pinned into the second pane, or null when there is one pane. */
export const SPLIT_PATH = '$/ui/editor/split' as BindingPath;

export function openTabs(store: ReactiveStore): string[] {
  return store.get<string[]>(TABS_PATH) ?? [];
}

export function activeTab(store: ReactiveStore): string | null {
  return store.get<string>(EDITOR_URI) ?? null;
}

export function splitTab(store: ReactiveStore): string | null {
  return store.get<string>(SPLIT_PATH) ?? null;
}

/**
 * What a tab is called.
 *
 * The last segment of the URI, which is the file name for a file and something
 * meaningful for anything else that gets opened - a diff, a log, a resource
 * from a provider nobody has written yet.
 */
export function tabLabel(uri: string): string {
  const path = uri.replace(/[?#].*$/, '').replace(/\/+$/, '');
  const last = path.slice(path.lastIndexOf('/') + 1);
  return last.length > 0 ? decodeURIComponent(last) : uri;
}

/**
 * A tab, as a path a person recognises.
 *
 * Two files called `index.ts` are two rows reading `index.ts` in any list that
 * only shows the name, so a list shows the path from the workspace root - and
 * the root itself is the part nobody needs to read twice.
 */
export function tabPath(store: ReactiveStore, uri: string): string {
  const root = store.get<Workspace>(WORKSPACE_PATH)?.rootUri ?? '';
  return root && uri.startsWith(root) ? uri.slice(root.length).replace(/^\//, '') : uri;
}

/** The tab a path from `tabPath` came from. */
export function tabFromPath(store: ReactiveStore, path: string): string | null {
  return openTabs(store).find((uri) => tabPath(store, uri) === path) ?? null;
}

/** Open a file, or bring the tab that already has it forward. */
export function openTab(store: ReactiveStore, uri: string): void {
  const tabs = openTabs(store);
  if (!tabs.includes(uri)) store.set(TABS_PATH, [...tabs, uri]);
  store.set(EDITOR_URI, uri);
}

/**
 * Make sure the active file has a tab.
 *
 * Anything at all may write `$/ui/editor/uri` - a command, a test, an
 * extension that has never heard of a tab strip - and the strip has to agree
 * with it rather than quietly showing something else.
 */
export function reconcileTabs(store: ReactiveStore): void {
  const uri = activeTab(store);
  if (!uri) return;
  const tabs = openTabs(store);
  if (!tabs.includes(uri)) store.set(TABS_PATH, [...tabs, uri]);
}

/**
 * Close one tab, and land somewhere sensible.
 *
 * The neighbour to the right, then the one to the left, because closing the
 * last tab in a strip and being thrown to the first is how you lose your place
 * in a row of twelve.
 */
export function closeTab(store: ReactiveStore, uri: string): void {
  const tabs = openTabs(store);
  const index = tabs.indexOf(uri);
  const rest = tabs.filter((t) => t !== uri);
  store.set(TABS_PATH, rest);

  // A pane pinned to a file that is not open any more is a pane showing a
  // file nobody can close.
  if (splitTab(store) === uri) store.set(SPLIT_PATH, null);

  if (activeTab(store) !== uri) return;
  const next = index >= 0 ? (rest[index] ?? rest[index - 1] ?? null) : (rest[0] ?? null);
  store.set(EDITOR_URI, next);
}

/** Move `delta` tabs along the strip, wrapping. */
export function stepTab(store: ReactiveStore, delta: number): void {
  const tabs = openTabs(store);
  if (tabs.length < 2) return;
  const at = tabs.indexOf(activeTab(store) ?? '');
  const next = tabs[(((at < 0 ? 0 : at) + delta) % tabs.length + tabs.length) % tabs.length];
  if (next) store.set(EDITOR_URI, next);
}

/**
 * Show a second file beside this one, or stop.
 *
 * Splitting with one file open pins that file - two views of one buffer, which
 * is the whole reason a split is worth having on a file too long to see at
 * once, and which works because the buffer is the document and not the pane.
 */
export function toggleSplit(store: ReactiveStore): string | null {
  if (splitTab(store) !== null) {
    store.set(SPLIT_PATH, null);
    return null;
  }
  const uri = activeTab(store);
  if (!uri) return null;
  const tabs = openTabs(store);
  // Beside it goes the next file along, or the same one when there is no
  // other. Pinning nothing would be a split with an empty half.
  const at = tabs.indexOf(uri);
  const beside = tabs[(at + 1) % Math.max(1, tabs.length)] ?? uri;
  store.set(SPLIT_PATH, beside);
  return beside;
}
