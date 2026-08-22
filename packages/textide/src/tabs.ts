import type { BindingPath, ReactiveStore } from '@textui/core';
import { WORKSPACE_PATH, type Workspace } from './workspace.js';

/**
 * The open files, as groups.
 *
 * A group is a strip of tabs and which of them is showing. One group is the
 * ordinary case and looks like a tab bar; two groups side by side or one above
 * the other is a split, and each half keeps its own strip - which is the point,
 * because a split whose halves share one strip is two panes showing whatever
 * the last click did rather than two places to be.
 *
 * Everything is derived from the list. The label is the last segment of the
 * URI, the dirty marker is the buffer's, and `$/ui/editor/uri` keeps meaning
 * exactly what it meant when there was one view - the file you are looking at
 * - so everything that reads it still works and writing to it still opens a
 * file. The groups are the truth and that path is kept in step with them,
 * rather than the other way round, which is what stops "open a file" from
 * having two implementations.
 */

export const EDITOR_URI = '$/ui/editor/uri' as BindingPath;
export const EDITOR_MODE = '$/ui/editor/mode' as BindingPath;
/** How much the editor has selected, for the status bar. */
export const EDITOR_SELECTION = '$/ui/editor/selection' as BindingPath;
/** Every group, in the order they are drawn. */
export const GROUPS_PATH = '$/ui/editor/groups' as BindingPath;
/** Which group the keyboard is in. */
export const GROUP_PATH = '$/ui/editor/group' as BindingPath;
/** How the groups are arranged. */
export const LAYOUT_PATH = '$/ui/editor/layout' as BindingPath;

/**
 * How the groups are arranged.
 *
 * The names are the runtime's own - a surface holding several mounts is
 * `tabs`, `split` or `stack` - because this is the same question asked of a
 * smaller thing, and answering it with a different vocabulary would be two
 * words for one idea.
 */
export type EditorLayout = 'tabs' | 'split' | 'stack';

/**
 * The focus scope each group registers.
 *
 * Named rather than numbered, and the first is still `pane.main`: it is the
 * pane there has always been, and everything that names it means the one the
 * keyboard starts in. Exported so the component that registers the scope and
 * the command that focuses it cannot disagree about the spelling.
 */
export const PANE_SCOPES = ['pane.main', 'pane.split'] as const;

export function paneScope(index: number): string {
  return PANE_SCOPES[index] ?? `pane.${index}`;
}

export const EDITOR_LAYOUTS: readonly EditorLayout[] = ['tabs', 'split', 'stack'];

export interface Group {
  /** Open files, in strip order. */
  tabs: string[];
  /** The one showing, or null for a group with nothing in it. */
  active: string | null;
}

const EMPTY: Group = { tabs: [], active: null };

export function readGroups(store: ReactiveStore): Group[] {
  const groups = store.get<Group[]>(GROUPS_PATH);
  return groups && groups.length > 0 ? groups : [EMPTY];
}

/** Which group the keyboard is in, clamped to one that exists. */
export function focusedIndex(store: ReactiveStore): number {
  const groups = readGroups(store);
  const at = store.get<number>(GROUP_PATH) ?? 0;
  return Math.max(0, Math.min(at, groups.length - 1));
}

export function focusedGroup(store: ReactiveStore): Group {
  return readGroups(store)[focusedIndex(store)] ?? EMPTY;
}

export function layoutOf(store: ReactiveStore): EditorLayout {
  const layout = store.get<EditorLayout>(LAYOUT_PATH);
  return layout && EDITOR_LAYOUTS.includes(layout) ? layout : 'tabs';
}

/**
 * Write the groups, and the file you are looking at, together.
 *
 * One function, because those two are one fact. Two callers each setting half
 * of it is how a titlebar ends up naming a file no pane is showing.
 */
function commit(store: ReactiveStore, groups: Group[], focused: number): void {
  const live = groups.length > 0 ? groups : [EMPTY];
  const at = Math.max(0, Math.min(focused, live.length - 1));
  store.set(GROUPS_PATH, live);
  store.set(GROUP_PATH, at);
  store.set(EDITOR_URI, live[at]?.active ?? null);
}

/** Every open file, in the group the keyboard is in. */
export function openTabs(store: ReactiveStore): string[] {
  return focusedGroup(store).tabs;
}

/** Every open file, in every group. */
export function allTabs(store: ReactiveStore): string[] {
  return [...new Set(readGroups(store).flatMap((group) => group.tabs))];
}

export function activeTab(store: ReactiveStore): string | null {
  return focusedGroup(store).active;
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

/** The tab a path from `tabPath` came from, in whichever group holds it. */
export function tabFromPath(store: ReactiveStore, path: string): string | null {
  return allTabs(store).find((uri) => tabPath(store, uri) === path) ?? null;
}

/** Open a file in the group the keyboard is in, or bring it forward there. */
export function openTab(store: ReactiveStore, uri: string): void {
  const groups = readGroups(store);
  const at = focusedIndex(store);
  const group = groups[at] ?? EMPTY;
  const tabs = group.tabs.includes(uri) ? group.tabs : [...group.tabs, uri];
  commit(store, groups.map((g, i) => (i === at ? { tabs, active: uri } : g)), at);
}

/** Show a file that is already open, in the group that has it. */
export function activateTab(store: ReactiveStore, group: number, uri: string): void {
  const groups = readGroups(store);
  if (!groups[group]?.tabs.includes(uri)) return;
  commit(store, groups.map((g, i) => (i === group ? { ...g, active: uri } : g)), group);
}

/**
 * Make sure the file you are looking at is open somewhere.
 *
 * Anything at all may write `$/ui/editor/uri` - a command, a test, an
 * extension that has never heard of a group - and the strips have to agree
 * with it rather than quietly showing something else. A file the *other*
 * group already has moves the keyboard there instead of opening a second copy
 * of it, because two tabs on one file in two groups is a split nobody can
 * reason about.
 */
export function reconcileTabs(store: ReactiveStore): void {
  const uri = store.get<string>(EDITOR_URI) ?? null;
  const groups = readGroups(store);
  const at = focusedIndex(store);
  const group = groups[at] ?? EMPTY;
  if (uri === group.active) return;

  if (uri === null) {
    commit(store, groups.map((g, i) => (i === at ? { ...g, active: null } : g)), at);
    return;
  }

  const elsewhere = groups.findIndex((g, i) => i !== at && g.tabs.includes(uri));
  if (elsewhere >= 0) {
    commit(store, groups.map((g, i) => (i === elsewhere ? { ...g, active: uri } : g)), elsewhere);
    return;
  }
  openTab(store, uri);
}

/**
 * Close one tab, and land somewhere sensible.
 *
 * The neighbour to the right, then the one to the left, because closing the
 * last tab in a strip and being thrown to the first is how you lose your place
 * in a row of twelve. A group left with nothing in it is not a pane, it is a
 * hole, so it goes.
 */
export function closeTab(store: ReactiveStore, uri: string): void {
  const groups = readGroups(store);
  const at = groups.findIndex((g) => g.tabs.includes(uri));
  if (at < 0) return;
  const group = groups[at] as Group;
  const index = group.tabs.indexOf(uri);
  const rest = group.tabs.filter((t) => t !== uri);
  const active = group.active === uri ? (rest[index] ?? rest[index - 1] ?? null) : group.active;

  let next = groups.map((g, i) => (i === at ? { tabs: rest, active } : g));
  let focused = focusedIndex(store);
  if (rest.length === 0 && next.length > 1) {
    next = next.filter((_, i) => i !== at);
    focused = focused > at ? focused - 1 : Math.min(focused, next.length - 1);
  }
  commit(store, next, focused);
}

/** Move `delta` tabs along the focused group's strip, wrapping. */
export function stepTab(store: ReactiveStore, delta: number): void {
  const group = focusedGroup(store);
  if (group.tabs.length < 2) return;
  const at = group.tabs.indexOf(group.active ?? '');
  const next = group.tabs[
    ((((at < 0 ? 0 : at) + delta) % group.tabs.length) + group.tabs.length) % group.tabs.length
  ];
  if (next) activateTab(store, focusedIndex(store), next);
}

/**
 * Select the nth tab of the focused group, counting from one.
 *
 * Nothing happens when there is no nth, rather than clamping to the last: a
 * key that always does *something* teaches you nothing about how many files
 * you have open, and `alt+7` quietly meaning `alt+4` is worse than `alt+7`
 * meaning nothing.
 */
export function selectTab(store: ReactiveStore, index: number): boolean {
  const uri = focusedGroup(store).tabs[index - 1];
  if (uri === undefined) return false;
  activateTab(store, focusedIndex(store), uri);
  return true;
}

/** Put the keyboard in a group. */
export function focusGroup(store: ReactiveStore, index: number): void {
  const groups = readGroups(store);
  commit(store, groups, index);
}

/** The other one. With one group there is no other one. */
export function otherGroup(store: ReactiveStore): boolean {
  const groups = readGroups(store);
  if (groups.length < 2) return false;
  focusGroup(store, (focusedIndex(store) + 1) % groups.length);
  return true;
}

/**
 * Put the file you are on beside the one you were on.
 *
 * The active tab moves into a new group rather than being copied: a split is
 * two places to be, and two tabs on one file is what the *other* case is for.
 * Splitting with one file open pins that file in both - two views of one
 * buffer, which is the whole reason a split is worth having on a file too long
 * to see at once, and which works because the buffer is the document and not
 * the pane.
 */
export function splitEditor(store: ReactiveStore, layout: EditorLayout = 'split'): boolean {
  const groups = readGroups(store);
  if (groups.length > 1) return false;
  const group = groups[0] ?? EMPTY;
  if (!group.active) return false;

  const alone = group.tabs.length < 2;
  const rest = alone ? group.tabs : group.tabs.filter((t) => t !== group.active);
  const index = group.tabs.indexOf(group.active);
  const restActive = alone ? group.active : (rest[index] ?? rest[index - 1] ?? null);

  commit(store, [
    { tabs: rest, active: restActive },
    { tabs: [group.active], active: group.active },
  ], 1);
  store.set(LAYOUT_PATH, layout === 'tabs' ? 'split' : layout);
  return true;
}

/** One group again, holding everything that was open in any of them. */
export function unsplit(store: ReactiveStore): boolean {
  const groups = readGroups(store);
  if (groups.length < 2) return false;
  const active = focusedGroup(store).active;
  const tabs = allTabs(store);
  commit(store, [{ tabs, active: active ?? tabs[0] ?? null }], 0);
  store.set(LAYOUT_PATH, 'tabs');
  return true;
}

/**
 * Arrange the groups, splitting or merging as the arrangement requires.
 *
 * `tabs` is one group by definition, so choosing it merges; the other two need
 * a second group, so choosing one splits if there is not already one.
 */
export function setLayout(store: ReactiveStore, layout: EditorLayout): void {
  if (layout === 'tabs') {
    if (!unsplit(store)) store.set(LAYOUT_PATH, 'tabs');
    return;
  }
  if (readGroups(store).length > 1) {
    store.set(LAYOUT_PATH, layout);
    return;
  }
  if (!splitEditor(store, layout)) store.set(LAYOUT_PATH, layout);
}
