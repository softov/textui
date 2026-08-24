import type { BindingPath, Disposable, TextUIApp } from '@textui/core';
import type { StatusSegment } from '@textui/widgets';

/**
 * Hot reload.
 *
 * The esbuild watch is twenty lines and is not the problem. The problem is
 * that a rebuild produces new module instances while the registries hold the
 * old ones, so a reload that disposes nothing gets two `file.save` commands
 * and two viewers claiming `file.markdown`, and a reload that disposes too
 * much takes the host application's registrations with it.
 *
 * The rule is ownership: a reload disposes the bag it made last time and
 * nothing else. `registerTextide` returns exactly one bag for this reason, and
 * the entry point hands it here rather than dropping it.
 *
 * The store is never touched. What a person had typed, which file they had
 * open and where they had scrolled to all live there, and none of it goes
 * through the reload - which is the whole point, because navigating back to
 * what you were looking at is most of what the quit-and-run loop costs.
 */

export type Registrar = (app: TextUIApp) => Disposable;

export interface ReloaderOptions {
  /**
   * Build the next module and return its register function.
   *
   * Called *before* anything is disposed, and allowed to throw: a build that
   * fails after the registries have been emptied is a black screen with no way
   * back, so the swap only happens once there is something to swap in.
   */
  load(generation: number): Promise<Registrar>;
  /** The bag from the registration that is running now. */
  initial: Disposable;
  /** Injected so a test does not have to wait for a clock. */
  now?(): number;
}

export interface ReloadOutcome {
  ok: boolean;
  /** How many reloads have been attempted, successful or not. */
  generation: number;
  ms: number;
  error?: unknown;
}

export interface Reloader extends Disposable {
  reload(): Promise<ReloadOutcome>;
  generation(): number;
}

/** Where the reload reports itself. The status bar reads this. */
export const STATUS_SEGMENTS = '$/ui/status/segments' as BindingPath;
const SEGMENT_ID = 'reload';

/**
 * Say what happened, in the status bar.
 *
 * A toast would be wrong: it lands on the frame somebody is looking at, and
 * the whole reason to reload rather than restart is to keep looking at it.
 * The segment merges with whatever else is contributing rather than replacing
 * the list, because this is the same extension point everything else uses.
 */
function report(app: TextUIApp, segment: StatusSegment | null): void {
  const current = app.store.get<StatusSegment[]>(STATUS_SEGMENTS) ?? [];
  const rest = current.filter((s) => s.id !== SEGMENT_ID);
  app.store.set(STATUS_SEGMENTS, segment ? [...rest, segment] : rest);
}

export function createReloader(app: TextUIApp, options: ReloaderOptions): Reloader {
  const now = options.now ?? ((): number => Date.now());
  let bag = options.initial;
  let count = 0;
  let running = false;

  const reload = async (): Promise<ReloadOutcome> => {
    // Two reloads at once would dispose the same bag twice and register twice.
    // A save while a build is running is common enough that this is not a
    // theoretical race.
    if (running) return { ok: false, generation: count, ms: 0, error: new Error('reload in progress') };
    running = true;
    const started = now();
    const generation = ++count;

    let next: Registrar;
    try {
      next = await options.load(generation);
    } catch (error) {
      running = false;
      report(app, { id: SEGMENT_ID, label: 'reload failed', tone: 'danger' });
      return { ok: false, generation, ms: now() - started, error };
    }

    /*
     * An open layer holds a node built by the module that is about to stop
     * existing. Keeping it would put a palette from the previous build on top
     * of the new one, and there is no honest way to reason about what its rows
     * would then run. Closing every layer is the answer that is always right.
     */
    for (const entry of app.layers.entries()) app.layers.close(entry.id, 'api');

    // Focus ids are strings, so an id a component registers again survives the
    // remount. One it generated does not, which is why this is best effort and
    // not a promise.
    const focused = app.focus.focused();

    try {
      bag.dispose();
      bag = next(app);
    } catch (error) {
      running = false;
      report(app, { id: SEGMENT_ID, label: 'reload failed', tone: 'danger' });
      return { ok: false, generation, ms: now() - started, error };
    }

    if (focused && app.focus.has(focused)) app.focus.focus(focused);

    const ms = now() - started;
    report(app, { id: SEGMENT_ID, label: `reloaded ${generation} (${ms}ms)`, tone: 'success' });
    running = false;
    return { ok: true, generation, ms };
  };

  return {
    reload,
    generation: () => count,
    dispose: () => {
      report(app, null);
      bag.dispose();
    },
  };
}
