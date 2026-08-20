import type { Disposable } from './disposable.js';
import type { BindingPath, EventPath } from './graph.js';

/**
 * Scopes are lifetimes, not folders. The first segment of an absolute path
 * names one, and `clearScope` is what makes sign-out or screen-teardown a
 * single call rather than a cascade of resets.
 */
export type ScopeName =
  | 'local'      // dies with the mount
  | 'screen'     // dies with the screen
  | 'session'    // dies with the process
  | 'app'        // outlives screens; the application's own state
  | 'global'     // outlives everything the app can clear
  | 'summary'    // derived counts and rollups
  | 'active'     // what is selected, application-wide
  | 'ui'         // chrome state: collapsed, expanded, scrolled
  | 'layout'     // surfaces, mounts, the active shell
  | 'modus'      // the environment: size, capabilities, locale
  | `plugins.${string}`
  | (string & {});

export type SubscribeOptions = {
  /** Fire for changes at or below the path, not only exact hits. */
  subtree?: boolean;
  /** Deliver the current value immediately on subscribe. */
  immediate?: boolean;
};

export interface ChangeRecord {
  path: BindingPath;
  value: unknown;
  previous: unknown;
}

export type ComputedDefinition<T = unknown> =
  | { from: BindingPath[]; select: (values: Record<string, unknown>) => T }
  /** A tiny expression over the `from` paths, for computed defined as data. */
  | { from: BindingPath[]; select: string };

/**
 * A namespace and the code that fills it. Lazy by default: nothing loads until
 * something reads or subscribes below `namespace`.
 */
export interface DataProviderDefinition {
  namespace: string;
  load?: 'lazy' | 'eager';
  /** Unload this many ms after the last subscriber leaves. */
  unloadAfter?: number;
  provider: {
    load(store: ReactiveStore): Promise<void> | void;
    unload?(store: ReactiveStore): Promise<void> | void;
    loadOne?(id: string): Promise<unknown>;
  };
}

/** Optional shape checking. Dynamic paths stay legal either way. */
export interface PathSchema {
  path: BindingPath;
  /** Return null when valid, a message when not. */
  validate(value: unknown): string | null;
  /** Seeded when the path is first read and still empty. */
  initial?: unknown;
}

/** Persist selected paths or subtrees across runs. */
export interface PersistenceAdapter {
  id: string;
  /** Paths and subtrees this adapter owns. Subtree if it ends in `/`. */
  paths: string[];
  read(): Promise<Record<string, unknown>> | Record<string, unknown>;
  write(entries: Record<string, unknown>): Promise<void> | void;
  /** Coalesce writes by this many ms. */
  debounceMs?: number;
}

/** Collection helpers operate on a path holding an array. */
export interface CollectionOps<T = unknown> {
  all(): T[];
  at(index: number): T | undefined;
  find(pred: (item: T, i: number) => boolean): T | undefined;
  append(...items: T[]): void;
  prepend(...items: T[]): void;
  insertAt(index: number, ...items: T[]): void;
  removeAt(index: number): void;
  remove(pred: (item: T, i: number) => boolean): number;
  update(pred: (item: T, i: number) => boolean, patch: Partial<T> | ((item: T) => T)): number;
  replace(items: T[]): void;
  filter(pred: (item: T, i: number) => boolean): T[];
  clear(): void;
  /** Keep at most `n` items, dropping from the front. For log tails. */
  cap(n: number): void;
  readonly length: number;
}

export interface ReactiveStore extends Disposable {
  get<T = unknown>(path: BindingPath): T | undefined;
  /** `get` with a fallback, so callers stop writing `?? default` everywhere. */
  read<T>(path: BindingPath, fallback: T): T;
  set(path: BindingPath, value: unknown): void;
  /** Functional update - receives the current value. */
  update<T = unknown>(path: BindingPath, fn: (current: T | undefined) => T): void;
  /** Shallow-merge into an object at `path`. */
  patch(path: BindingPath, partial: Record<string, unknown>): void;
  /** Many writes, one notification pass. */
  patchMany(entries: Record<BindingPath, unknown>): void;
  delete(path: BindingPath): void;
  has(path: BindingPath): boolean;

  /** Coalesce every write inside `fn` into a single notification pass. */
  batch<T>(fn: () => T): T;

  subscribe(
    path: BindingPath,
    fn: (value: unknown, change: ChangeRecord) => void,
    options?: SubscribeOptions,
  ): Disposable;

  clearScope(scope: ScopeName | string): void;
  subscriberCount(scope: ScopeName | string): number;

  computed<T = unknown>(path: BindingPath, def: ComputedDefinition<T>): Disposable;
  collection<T = unknown>(path: BindingPath): CollectionOps<T>;

  registerDataProvider(def: DataProviderDefinition): Disposable;
  listDataProviders(): DataProviderDefinition[];

  registerSchema(schema: PathSchema): Disposable;
  registerPersistence(adapter: PersistenceAdapter): Disposable;
  /** Load every registered persistence adapter. Call once at boot. */
  hydrate(): Promise<void>;

  /** Everything below `scope`, as a plain object. For snapshots and tests. */
  snapshot(scope?: ScopeName | string): Record<string, unknown>;
  restore(snapshot: Record<string, unknown>): void;
}

/**
 * Transient events. Same path convention as the store, deliberately not the
 * same mechanism - an event has no value to read back, which is the whole
 * difference between `$/dialog/open` and `@/dialog/confirm`.
 */
export interface EventBus extends Disposable {
  emit(path: EventPath, payload?: unknown): void;
  on(path: EventPath, fn: (payload: unknown, path: EventPath) => void, options?: { subtree?: boolean; once?: boolean }): Disposable;
  /** Resolve on the next emit at this path. */
  next(path: EventPath, timeoutMs?: number): Promise<unknown>;
}
