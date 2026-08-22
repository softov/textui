import type { BindingPath } from '../types/graph.js';
import type { ReactiveStore } from '../types/store.js';
import { useStoreValue } from '../runtime/hooks.js';

/**
 * Finding things in text.
 *
 * The query lives in the store rather than in whatever component is showing
 * the text, for the usual reason: a search box, a status bar counting matches
 * and the viewer painting them are three things that have to agree, and the
 * only way three things agree is by reading one answer.
 *
 * The matching itself is here and not in the editor because a viewer wants it
 * too, and so will a results panel: given a string and a query, which spans
 * matched. Nothing here knows what a caret is.
 */

export const FIND_ROOT = '$/ui/find';
export const FIND_QUERY = `${FIND_ROOT}/query` as BindingPath;
export const FIND_CASE = `${FIND_ROOT}/matchCase` as BindingPath;
/** Bumped to ask whoever is showing the text to move to the next match. */
export const FIND_STEP = `${FIND_ROOT}/step` as BindingPath;

export interface FindQuery {
  text: string;
  matchCase?: boolean;
}

/** Where one match is: the line it is on, and the columns it covers. */
export interface Match {
  line: number;
  start: number;
  end: number;
}

/**
 * Every match in a document, in reading order.
 *
 * Overlapping matches are not a thing: a search steps past what it found, so
 * `aa` in `aaaa` is two matches and not three. That is what every editor does
 * and what "next" means when you press it twice.
 */
export function findMatches(text: string, query: FindQuery): Match[] {
  const needle = query.matchCase === true ? query.text : query.text.toLowerCase();
  if (needle === '') return [];

  const out: Match[] = [];
  const lines = text.split('\n');
  for (let line = 0; line < lines.length; line++) {
    const raw = lines[line] as string;
    const haystack = query.matchCase === true ? raw : raw.toLowerCase();
    let at = haystack.indexOf(needle);
    while (at !== -1) {
      out.push({ line, start: at, end: at + needle.length });
      at = haystack.indexOf(needle, at + needle.length);
    }
  }
  return out;
}

/**
 * The match a caret should go to next, wrapping at the end.
 *
 * From *after* the caret, not from the caret: pressing next while sitting on a
 * match has to move, or "next" is a key that does nothing. Backwards is the
 * mirror, and both wrap, because a search that stops at the end of the file is
 * a search you have to restart by hand.
 */
export function stepMatch(
  matches: Match[],
  from: { line: number; column: number },
  direction: 1 | -1,
): number {
  if (matches.length === 0) return -1;

  if (direction === 1) {
    const found = matches.findIndex(
      (m) => m.line > from.line || (m.line === from.line && m.start > from.column),
    );
    return found === -1 ? 0 : found;
  }

  /*
   * Backwards, from *before* the caret - and the caret is usually sitting at
   * the end of the match it just stepped to, so "before" has to mean the match
   * *ends* before it. Comparing starts instead finds the match the caret is
   * standing in and calls that the previous one, which is a key that does
   * nothing every other press.
   */
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i] as Match;
    if (m.line < from.line || (m.line === from.line && m.end < from.column)) return i;
  }
  return matches.length - 1;
}

/** Which match the caret is sitting inside, or -1. */
export function matchAt(matches: Match[], at: { line: number; column: number }): number {
  return matches.findIndex(
    (m) => m.line === at.line && at.column >= m.start && at.column <= m.end,
  );
}

export function readQuery(store: ReactiveStore): FindQuery {
  return {
    text: store.get<string>(FIND_QUERY) ?? '',
    matchCase: store.get<boolean>(FIND_CASE) === true,
  };
}

export function setQuery(store: ReactiveStore, text: string): void {
  store.set(FIND_QUERY, text);
}

/**
 * Ask whoever is showing the text to move.
 *
 * A counter rather than a command, so the thing that moves is the thing that
 * knows where the caret is - and so two panels showing the same file each move
 * their own.
 */
export function stepFind(store: ReactiveStore, direction: 1 | -1): void {
  const at = store.get<{ n: number }>(FIND_STEP);
  store.set(FIND_STEP, { n: (at?.n ?? 0) + 1, direction });
}

export interface FindHandle {
  query: FindQuery;
  /** Changes when somebody asks for the next match. */
  step: { n: number; direction: 1 | -1 } | undefined;
}

/** The current query, and the ask to move, for a component showing text. */
export function useFind(): FindHandle {
  const text = useStoreValue<string>(FIND_QUERY, '') ?? '';
  const matchCase = useStoreValue<boolean>(FIND_CASE, false) === true;
  const step = useStoreValue<{ n: number; direction: 1 | -1 }>(FIND_STEP);
  return { query: { text, matchCase }, step };
}
