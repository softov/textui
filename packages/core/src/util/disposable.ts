import type { Disposable, DisposableBag } from '../types/disposable.js';

export const NOOP_DISPOSABLE: Disposable = { dispose() {} };

export function toDisposable(fn: () => void): Disposable {
  let done = false;
  return {
    dispose() {
      if (done) return;
      done = true;
      fn();
    },
  };
}

export function disposeAll(items: Iterable<Disposable>): void {
  const errors: unknown[] = [];
  for (const d of items) {
    try {
      d.dispose();
    } catch (err) {
      errors.push(err);
    }
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw new AggregateError(errors, 'dispose failed');
}

export function createBag(): DisposableBag {
  const items = new Set<Disposable>();
  let disposed = false;
  return {
    add<T extends Disposable>(d: T): T {
      if (disposed) {
        d.dispose();
        return d;
      }
      items.add(d);
      return d;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      const copy = [...items];
      items.clear();
      disposeAll(copy);
    },
  };
}
