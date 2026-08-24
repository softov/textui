import type { BindingPath, ReactiveStore, SemanticVariant, StyleColor } from '@textui/core';
import { useStoreSubtree, useRuntime, escapeSegment } from '@textui/core';

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

// ------------------------------------------------------------------ lines

/**
 * Marks on lines, which is the same idea one level down.
 *
 * A gutter belongs to whatever is drawing the file, and what a line *means* -
 * added since the last commit, covered by a test, carrying an error - belongs
 * to whatever knows that. Same bargain as the tree: the editor draws a column
 * of marks and has never heard of git.
 *
 * Kept per resource rather than per panel, because "this line is new" is true
 * of the file and not of where you happen to be looking at it.
 */
export const LINE_MARKS_ROOT = '$/ui/line-marks';

export type LineMark = 'added' | 'changed' | 'removed';

/** Line numbers count from zero, like an index, because a caret does. */
export type LineMarks = Record<number, LineMark>;

/**
 * What a marked line looks like, in one cell.
 *
 * ASCII, so every terminal draws one - and here rather than in whichever
 * component happened to need it first, because two renderers drawing the same
 * mark differently is the same file looking like two files. It lived in the
 * editor, which is why the *viewer* drew no marks at all: you turned the
 * setting on, stayed in view mode, and nothing happened.
 */
export const MARK_GLYPH: Record<LineMark, string> = {
  added: '+',
  changed: '~',
  removed: '_',
};

export const MARK_TONE: Record<LineMark, StyleColor> = {
  added: 'success',
  changed: 'warning',
  removed: 'danger',
};

export function lineMarksPath(source: string, uri: string): BindingPath {
  return `${LINE_MARKS_ROOT}/${escapeSegment(source)}/${escapeSegment(uri)}` as BindingPath;
}

export function setLineMarks(
  store: ReactiveStore,
  source: string,
  uri: string,
  marks: LineMarks | null,
): void {
  store.set(lineMarksPath(source, uri), marks);
}

/** Drop everything one contributor said, wherever it said it. */
export function clearLineMarks(store: ReactiveStore, source: string): void {
  store.set(`${LINE_MARKS_ROOT}/${escapeSegment(source)}` as BindingPath, null);
}

export function lineMarksFor(store: ReactiveStore, uri: string | null): LineMarks {
  if (uri === null) return {};
  const all = store.get<Record<string, Record<string, LineMarks>>>(
    LINE_MARKS_ROOT as BindingPath,
  );
  if (!all) return {};

  const key = escapeSegment(uri);
  let merged: LineMarks = {};
  for (const bySource of Object.values(all)) {
    const found = bySource?.[key];
    if (found) merged = { ...merged, ...found };
  }
  return merged;
}

/**
 * The marks on one file, redrawn when they change.
 *
 * One subscription, and an empty object when nobody has said anything - so a
 * renderer can ask unconditionally and draw no column at all when the answer
 * is empty.
 */
export function useLineMarks(uri: string | null): LineMarks {
  const runtime = useRuntime();
  useStoreSubtree(LINE_MARKS_ROOT as BindingPath);
  return lineMarksFor(runtime.store, uri);
}
