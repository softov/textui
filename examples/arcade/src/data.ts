import type { BindingPath, ReactiveStore } from '@textui/core';

/**
 * What the arcade keeps.
 *
 * Three paths and no more, because almost nothing about a game belongs to the
 * application: the frame is the frame. What survives a run is the score, and
 * what survives leaving a game is which one you were looking at.
 *
 * `$/arcade/scores` is persisted; the other two are about this session, which
 * is the whole reason they are separate paths rather than one blob.
 */
export const SCORES = '$/arcade/scores' as BindingPath;
export const SELECTED = '$/arcade/ui/selected' as BindingPath;

/**
 * Paused, and which run is current.
 *
 * These are the two things about a game that are not the frame. Pausing is a
 * mode - the badge, the hint and the loop all have to agree about it - and a
 * restart is an event the screen has to hear about from somewhere else, since
 * the key that asks for one is a command like every other key in this
 * application. A counter rather than a flag: "restart" is not a state to be
 * in, it is a number going up, and the screen rebuilds when what it is showing
 * is not that number.
 */
export const PAUSED = '$/arcade/ui/paused' as BindingPath;
export const GENERATION = '$/arcade/run/generation' as BindingPath;

/**
 * The seed every game is created from.
 *
 * A number in the store rather than `Date.now()` in the component, so a test
 * can set it and get the same run twice - the games are already deterministic
 * given their seed, and this is the last thing between them and a repeatable
 * game. Unset means "a different game every time", which is what a person
 * wants and what a test never does.
 */
export const SEED = '$/arcade/seed' as BindingPath;

export function bestScore(store: ReactiveStore, gameId: string): number {
  const scores = store.get<Record<string, number>>(SCORES) ?? {};
  return scores[gameId] ?? 0;
}

/** A fresh run of whatever is on screen. */
export function newRun(store: ReactiveStore): void {
  store.set(PAUSED, false);
  store.set(GENERATION, (store.get<number>(GENERATION) ?? 0) + 1);
}

/** Written once, when a run ends. Returns true when it was a new best. */
export function recordScore(store: ReactiveStore, gameId: string, score: number): boolean {
  const scores = store.get<Record<string, number>>(SCORES) ?? {};
  if (score <= (scores[gameId] ?? 0)) return false;
  store.set(SCORES, { ...scores, [gameId]: score });
  return true;
}
