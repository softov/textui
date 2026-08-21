/**
 * Undo, as a value.
 *
 * Two stacks and a rule about when to push, kept as pure functions over a
 * plain object so the same history works for a buffer that lives in the store
 * and for an editor that has no document behind it at all. Nothing here knows
 * what a component is.
 *
 * The entries are whole snapshots rather than diffs. A diff is smaller and it
 * is also a second representation of the text that has to stay in agreement
 * with the first one; for files that fit in a terminal, being obviously
 * correct is worth more than being small. `HISTORY_LIMIT` is what stops it
 * from being unbounded.
 */

export interface DocumentCursor {
  line: number;
  column: number;
}

export interface Snapshot {
  content: string;
  cursor?: DocumentCursor;
}

export interface History {
  /** Where to go back to, oldest first. */
  past: Snapshot[];
  /** Where to go forward to, undone most recently last. */
  future: Snapshot[];
  /**
   * What kind of edit made the newest entry, while it can still absorb more.
   *
   * Typing a word is one thing that happened, not eight, so consecutive edits
   * that name the same kind fold into the entry already on the stack. Anything
   * that names a different kind - or names none - closes it.
   */
  open: string | null;
}

/** How many steps back a buffer remembers. */
export const HISTORY_LIMIT = 200;

export const EMPTY_HISTORY: History = { past: [], future: [], open: null };

/**
 * Note that an edit is about to happen.
 *
 * Takes the state *before* the change, because that is what undo goes back to
 * - including where the caret was, which is half of what makes undo feel like
 * undo rather than like a content swap.
 */
export function record(history: History, before: Snapshot, coalesce?: string | null): History {
  // A run of the same kind of edit is one entry. The snapshot already on the
  // stack is the one from the start of the run, which is where undo belongs.
  if (coalesce && history.open === coalesce && history.past.length > 0) {
    return { ...history, future: [] };
  }
  const past = [...history.past, before].slice(-HISTORY_LIMIT);
  // Editing after undoing abandons what was undone. Keeping it would mean
  // "redo" could reach a text this one never came from.
  return { past, future: [], open: coalesce ?? null };
}

export function canUndo(history: History): boolean {
  return history.past.length > 0;
}

export function canRedo(history: History): boolean {
  return history.future.length > 0;
}

/** Step back. Returns the state to restore, and the history that follows it. */
export function undo(
  history: History,
  current: Snapshot,
): { history: History; to: Snapshot } | null {
  const to = history.past[history.past.length - 1];
  if (!to) return null;
  return {
    to,
    history: {
      past: history.past.slice(0, -1),
      future: [...history.future, current],
      // A step is a boundary: the next keystroke starts a new entry rather
      // than folding into the one undo just left behind.
      open: null,
    },
  };
}

export function redo(
  history: History,
  current: Snapshot,
): { history: History; to: Snapshot } | null {
  const to = history.future[history.future.length - 1];
  if (!to) return null;
  return {
    to,
    history: {
      past: [...history.past, current],
      future: history.future.slice(0, -1),
      open: null,
    },
  };
}
