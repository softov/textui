import type { Disposable } from '../types/disposable.js';
import type { Stream, StreamObserver, StreamSource } from '../types/stream.js';
import type { ReactiveStore } from '../types/store.js';
import type { BindingPath } from '../types/graph.js';
import { toDisposable } from './disposable.js';

/**
 * The smallest useful stream, plus adapters.
 *
 * A LogViewer should not care whether its lines come from a child process, an
 * async iterable or a store path - so everything is adapted to one shape here,
 * and nowhere else has to know the difference.
 */

export function createStream<T>(
  start: (observer: StreamObserver<T>) => (() => void) | void,
): Stream<T> {
  return {
    subscribe(observer) {
      let closed = false;
      const guard: StreamObserver<T> = {
        next: (v) => { if (!closed) observer.next(v); },
        error: (e) => { if (!closed) observer.error?.(e); },
        complete: () => { if (!closed) observer.complete?.(); },
      };
      const stop = start(guard);
      return toDisposable(() => {
        closed = true;
        stop?.();
      });
    },
  };
}

export function fromAsyncIterable<T>(iterable: AsyncIterable<T>): Stream<T> {
  return createStream<T>((observer) => {
    let cancelled = false;
    void (async () => {
      try {
        for await (const value of iterable) {
          if (cancelled) return;
          observer.next(value);
        }
        observer.complete?.();
      } catch (err) {
        if (!cancelled) observer.error?.(err);
      }
    })();
    return () => { cancelled = true; };
  });
}

export function fromIterable<T>(iterable: Iterable<T>): Stream<T> {
  return createStream<T>((observer) => {
    for (const value of iterable) observer.next(value);
    observer.complete?.();
  });
}

/** Emit the value at a store path each time it changes. */
export function fromStorePath<T>(store: ReactiveStore, path: BindingPath): Stream<T> {
  return createStream<T>((observer) => {
    const sub = store.subscribe(path, (value) => observer.next(value as T), { immediate: true });
    return () => sub.dispose();
  });
}

/** Emit each item appended to a store collection, and nothing already there. */
export function fromStoreCollection<T>(store: ReactiveStore, path: BindingPath): Stream<T> {
  return createStream<T>((observer) => {
    let seen = (store.get<T[]>(path) ?? []).length;
    const sub = store.subscribe(path, (value) => {
      const list = Array.isArray(value) ? (value as T[]) : [];
      if (list.length < seen) seen = 0;
      for (let i = seen; i < list.length; i++) observer.next(list[i] as T);
      seen = list.length;
    });
    return () => sub.dispose();
  });
}

/** A source that pushes from the outside. Adapters and tests use this. */
export interface Subject<T> extends Stream<T> {
  next(value: T): void;
  error(err: unknown): void;
  complete(): void;
}

export function createSubject<T>(): Subject<T> {
  const observers = new Set<StreamObserver<T>>();
  let done = false;

  return {
    subscribe(observer): Disposable {
      if (done) {
        observer.complete?.();
        return toDisposable(() => {});
      }
      observers.add(observer);
      return toDisposable(() => observers.delete(observer));
    },
    next(value) {
      if (done) return;
      for (const o of [...observers]) o.next(value);
    },
    error(err) {
      if (done) return;
      done = true;
      for (const o of [...observers]) o.error?.(err);
      observers.clear();
    },
    complete() {
      if (done) return;
      done = true;
      for (const o of [...observers]) o.complete?.();
      observers.clear();
    },
  };
}

function isStream<T>(value: unknown): value is Stream<T> {
  return typeof value === 'object' && value !== null && 'subscribe' in value;
}

export function toStream<T>(source: StreamSource<T>): Stream<T> {
  if (typeof source === 'function') return fromAsyncIterable(source());
  if (isStream<T>(source)) return source;
  if (Symbol.asyncIterator in (source as object)) {
    return fromAsyncIterable(source as AsyncIterable<T>);
  }
  return fromIterable(source as Iterable<T>);
}

// ------------------------------------------------------------- operators

export function mapStream<T, U>(source: Stream<T>, fn: (value: T) => U): Stream<U> {
  return createStream<U>((observer) => {
    const sub = source.subscribe({
      next: (v) => observer.next(fn(v)),
      error: (e) => observer.error?.(e),
      complete: () => observer.complete?.(),
    });
    return () => sub.dispose();
  });
}

export function filterStream<T>(source: Stream<T>, pred: (value: T) => boolean): Stream<T> {
  return createStream<T>((observer) => {
    const sub = source.subscribe({
      next: (v) => { if (pred(v)) observer.next(v); },
      error: (e) => observer.error?.(e),
      complete: () => observer.complete?.(),
    });
    return () => sub.dispose();
  });
}

/** Split incoming chunks on newlines. What a log stream almost always wants. */
export function lines(source: Stream<string>): Stream<string> {
  return createStream<string>((observer) => {
    let carry = '';
    const sub = source.subscribe({
      next(chunk) {
        carry += chunk;
        const parts = carry.split('\n');
        carry = parts.pop() ?? '';
        for (const line of parts) observer.next(line);
      },
      error: (e) => observer.error?.(e),
      complete() {
        if (carry !== '') observer.next(carry);
        observer.complete?.();
      },
    });
    return () => sub.dispose();
  });
}

/** Emit at most one value per `ms`, keeping the latest. */
export function throttleStream<T>(source: Stream<T>, ms: number): Stream<T> {
  return createStream<T>((observer) => {
    let pending: T | undefined;
    let has = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const sub = source.subscribe({
      next(value) {
        pending = value;
        has = true;
        if (timer) return;
        timer = setInterval(() => {
          if (has) {
            observer.next(pending as T);
            has = false;
            return;
          }
          if (timer) clearInterval(timer);
          timer = null;
        }, ms);
        (timer as unknown as { unref?: () => void }).unref?.();
        observer.next(pending);
        has = false;
      },
      error: (e) => observer.error?.(e),
      complete: () => observer.complete?.(),
    });

    return () => {
      if (timer) clearInterval(timer);
      sub.dispose();
    };
  });
}
