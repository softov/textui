import type { Disposable } from './disposable.js';

/**
 * The smallest useful stream. A LogViewer should not care whether its lines
 * come from a Node stream, an async iterable, a child process or a store path,
 * so every source is adapted to this.
 */
export interface Stream<T> {
  subscribe(observer: StreamObserver<T>): Disposable;
  /** Best-effort stop at the source. */
  cancel?(): void;
}

export interface StreamObserver<T> {
  next(value: T): void;
  error?(err: unknown): void;
  complete?(): void;
}

export type StreamSource<T> =
  | Stream<T>
  | AsyncIterable<T>
  | Iterable<T>
  | (() => AsyncIterable<T>);
