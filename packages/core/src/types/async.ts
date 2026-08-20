import type { Disposable } from './disposable.js';

export type TaskStatus = 'idle' | 'running' | 'success' | 'error' | 'cancelled';

export interface TaskState<T = unknown> {
  status: TaskStatus;
  data?: T;
  error?: unknown;
  /** 0..1 when the task reports it, undefined when indeterminate. */
  progress?: number;
  /** Free-text step description, for a progress line. */
  step?: string;
  startedAt?: number;
  finishedAt?: number;
}

export interface TaskController<T = unknown> {
  readonly state: TaskState<T>;
  run(...args: unknown[]): Promise<T | undefined>;
  cancel(): void;
  reset(): void;
  subscribe(fn: (state: TaskState<T>) => void): Disposable;
}

export interface TaskRunContext {
  signal: AbortSignal;
  progress(value: number, step?: string): void;
}

export type TaskFn<T> = (ctx: TaskRunContext, ...args: any[]) => Promise<T> | T;

export interface ResourceState<T = unknown> extends TaskState<T> {
  /** Refetching while previous data is still shown. */
  refreshing: boolean;
}
