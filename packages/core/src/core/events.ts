import type { EventBus } from '../types/store.js';
import type { EventPath } from '../types/graph.js';
import type { Disposable } from '../types/disposable.js';
import { toDisposable } from '../util/disposable.js';
import { isDescendantKey, matchKey } from '../util/paths.js';

interface Listener {
  key: string;
  subtree: boolean;
  wildcard: boolean;
  once: boolean;
  fn: (payload: unknown, path: EventPath) => void;
}

function eventKey(path: string): string {
  const body = path.startsWith('@/') ? path.slice(2) : path.replace(/^\//, '');
  return body.split('/').filter((s) => s !== '').join('/');
}

/**
 * Transient events, addressed like store paths on purpose - `@/dialog/confirm`
 * reads the same way `$/dialog/open` does - but with no value to read back.
 * That difference is the whole reason they are two mechanisms.
 */
export class Events implements EventBus {
  private listeners = new Set<Listener>();
  private disposed = false;

  onError: (err: unknown, context: string) => void = (err, context) => {
    console.error(`[textui/events] ${context}`, err);
  };

  emit(path: EventPath, payload?: unknown): void {
    if (this.disposed) return;
    const key = eventKey(path);
    for (const listener of [...this.listeners]) {
      if (!this.matches(listener, key)) continue;
      if (listener.once) this.listeners.delete(listener);
      try {
        listener.fn(payload, path);
      } catch (err) {
        this.onError(err, `listener of @/${listener.key}`);
      }
    }
  }

  private matches(listener: Listener, key: string): boolean {
    if (listener.wildcard) return matchKey(key, listener.key, listener.subtree);
    if (listener.key === key) return true;
    return listener.subtree && isDescendantKey(key, listener.key);
  }

  on(
    path: EventPath,
    fn: (payload: unknown, path: EventPath) => void,
    options: { subtree?: boolean; once?: boolean } = {},
  ): Disposable {
    const key = eventKey(path);
    const listener: Listener = {
      key,
      subtree: options.subtree ?? false,
      wildcard: key.includes('*'),
      once: options.once ?? false,
      fn,
    };
    this.listeners.add(listener);
    return toDisposable(() => this.listeners.delete(listener));
  }

  next(path: EventPath, timeoutMs?: number): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const sub = this.on(path, (payload) => {
        if (timer) clearTimeout(timer);
        resolve(payload);
      }, { once: true });

      const timer = timeoutMs
        ? setTimeout(() => {
            sub.dispose();
            reject(new Error(`timed out waiting for ${path}`));
          }, timeoutMs)
        : null;
      timer?.unref?.();
    });
  }

  dispose(): void {
    this.disposed = true;
    this.listeners.clear();
  }
}

export function createEvents(): Events {
  return new Events();
}
