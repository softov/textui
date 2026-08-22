import type { BindingPath } from '../types/graph.js';
import type { ReactiveStore } from '../types/store.js';
import type { SemanticVariant } from '../types/style.js';
import { useStoreSubtree, useRuntime } from '../runtime/hooks.js';
import { escapeSegment } from '../util/paths.js';

/**
 * Marks on resources.
 *
 * A tree of files is the same tree whether or not anything has an opinion
 * about the files in it - so "this one is modified", "this one has an error",
 * "this one matched your search" cannot be properties of the explorer. They
 * are contributions, and the explorer's job is to draw whatever arrived.
 *
 * They live in the store rather than behind a registry because a decoration is
 * a *value that changes*, not a capability that is registered once: git
 * refreshes, a build finishes, a search runs again. The explorer subscribes to
 * one subtree and redraws; nothing has to be told about anything.
 *
 * Each contributor owns a source name and writes under it, which is what makes
 * two contributors possible and what makes unloading one of them a single
 * delete rather than a diff.
 */

export const DECORATIONS_ROOT = '$/ui/decorations';

export interface ResourceDecoration {
  /** A short mark at the end of the row. Wins over whatever the row had. */
  badge?: string;
  /** Colours the row, so a glance is enough. */
  tone?: SemanticVariant;
  /** Replaces the row's icon. */
  icon?: string;
}

/** Where one contributor's marks live. */
export function decorationsPath(source: string): BindingPath {
  return `${DECORATIONS_ROOT}/${escapeSegment(source)}` as BindingPath;
}

/**
 * Publish one contributor's marks, as a whole.
 *
 * The whole set at once, deliberately: a decoration that is *gone* - the file
 * was committed, the error was fixed - has to disappear, and a merge of
 * updates leaves the old ones behind forever.
 */
export function setDecorations(
  store: ReactiveStore,
  source: string,
  byUri: Record<string, ResourceDecoration>,
): void {
  const escaped: Record<string, ResourceDecoration> = {};
  for (const [uri, decoration] of Object.entries(byUri)) {
    escaped[escapeSegment(uri)] = decoration;
  }
  store.set(decorationsPath(source), escaped);
}

export function clearDecorations(store: ReactiveStore, source: string): void {
  store.set(decorationsPath(source), null);
}

/** Every contributor's mark for one resource, merged. */
export function decorationFor(store: ReactiveStore, uri: string): ResourceDecoration | null {
  const all = store.get<Record<string, Record<string, ResourceDecoration>>>(
    DECORATIONS_ROOT as BindingPath,
  );
  if (!all) return null;

  const key = escapeSegment(uri);
  let merged: ResourceDecoration | null = null;
  for (const bySource of Object.values(all)) {
    const found = bySource?.[key];
    if (found) merged = { ...(merged ?? {}), ...found };
  }
  return merged;
}

/**
 * A reader that redraws when anything changes.
 *
 * One subscription for the whole tree rather than one per row: a component
 * cannot call a hook per item without its hook count moving as the list does,
 * and the marks arrive as one refresh anyway.
 */
export function useDecorations(): (uri: string) => ResourceDecoration | null {
  const runtime = useRuntime();
  useStoreSubtree(DECORATIONS_ROOT as BindingPath);
  return (uri: string) => decorationFor(runtime.store, uri);
}
