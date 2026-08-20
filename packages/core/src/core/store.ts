import type {
  ChangeRecord, CollectionOps, ComputedDefinition, DataProviderDefinition,
  PathSchema, PersistenceAdapter, ReactiveStore, ScopeName, SubscribeOptions,
} from '../types/store.js';
import type { BindingPath } from '../types/graph.js';
import type { Disposable } from '../types/disposable.js';
import { toDisposable } from '../util/disposable.js';
import {
  ancestorKeys, hasWildcard, isDescendantKey, matchKey, pathKey, PathError,
} from '../util/paths.js';

interface Subscription {
  key: string;
  subtree: boolean;
  wildcard: boolean;
  fn: (value: unknown, change: ChangeRecord) => void;
}

interface ComputedEntry {
  key: string;
  deps: string[];
  compute(): unknown;
}

interface ProviderEntry {
  def: DataProviderDefinition;
  loaded: boolean;
  loading: Promise<void> | null;
  unloadTimer: ReturnType<typeof setTimeout> | null;
}

/**
 * The store is one tree, and it is the only place state lives. A component
 * that keeps a copy in its own state has created a second answer to a question
 * the store already answers.
 */
export class Store implements ReactiveStore {
  private root: Record<string, unknown> = {};
  private subs = new Set<Subscription>();
  private computedByKey = new Map<string, ComputedEntry>();
  private computedDeps = new Map<string, Set<string>>();
  private providers = new Map<string, ProviderEntry>();
  private schemas = new Map<string, PathSchema>();
  private persistence = new Set<PersistenceAdapter>();
  private persistTimers = new Map<string, ReturnType<typeof setTimeout>>();

  private batchDepth = 0;
  private pending = new Map<string, ChangeRecord>();
  private disposed = false;

  /** Thrown-away errors from listeners would hide bugs; collect and report. */
  onError: (err: unknown, context: string) => void = (err, context) => {
    console.error(`[textui/store] ${context}`, err);
  };

  // ---------------------------------------------------------------- reading

  get<T = unknown>(path: BindingPath): T | undefined {
    const key = pathKey(path);
    this.touchProvider(key);
    return this.readKey(key) as T | undefined;
  }

  read<T>(path: BindingPath, fallback: T): T {
    const v = this.get<T>(path);
    return v === undefined ? fallback : v;
  }

  has(path: BindingPath): boolean {
    return this.readKey(pathKey(path)) !== undefined;
  }

  private readKey(key: string): unknown {
    if (key === '') return this.root;
    const segs = key.split('/');
    let node: unknown = this.root;
    for (const seg of segs) {
      if (node === null || node === undefined) return undefined;
      if (Array.isArray(node)) {
        const i = Number(seg);
        if (!Number.isInteger(i)) return undefined;
        node = node[i];
        continue;
      }
      if (typeof node !== 'object') return undefined;
      node = (node as Record<string, unknown>)[seg];
    }
    return node;
  }

  // ---------------------------------------------------------------- writing

  set(path: BindingPath, value: unknown): void {
    if (hasWildcard(path)) {
      throw new PathError('wildcards are legal in subscriptions only', path);
    }
    const key = pathKey(path);
    this.writeKey(key, value);
  }

  update<T = unknown>(path: BindingPath, fn: (current: T | undefined) => T): void {
    this.set(path, fn(this.get<T>(path)));
  }

  patch(path: BindingPath, partial: Record<string, unknown>): void {
    const current = this.get<Record<string, unknown>>(path);
    const base = current && typeof current === 'object' && !Array.isArray(current) ? current : {};
    this.set(path, { ...base, ...partial });
  }

  patchMany(entries: Record<string, unknown>): void {
    this.batch(() => {
      for (const [path, value] of Object.entries(entries)) {
        this.set(path as BindingPath, value);
      }
    });
  }

  delete(path: BindingPath): void {
    const key = pathKey(path);
    const segs = key.split('/');
    const last = segs.pop() as string;
    const parent = segs.length === 0 ? this.root : this.readKey(segs.join('/'));
    if (parent === null || typeof parent !== 'object') return;
    const previous = (parent as Record<string, unknown>)[last];
    if (previous === undefined && !(last in (parent as object))) return;

    if (Array.isArray(parent)) parent.splice(Number(last), 1);
    else delete (parent as Record<string, unknown>)[last];

    this.enqueue({ path: `$/${key}` as BindingPath, value: undefined, previous });
    this.flushIfIdle();
  }

  private writeKey(key: string, value: unknown): void {
    if (this.disposed) return;
    if (key === '') throw new PathError('cannot write the store root', '$/');

    const schema = this.schemas.get(key);
    if (schema) {
      const problem = schema.validate(value);
      if (problem) throw new PathError(`schema rejected value (${problem})`, `$/${key}`);
    }

    const segs = key.split('/');
    const last = segs.pop() as string;

    let node: Record<string, unknown> = this.root;
    for (const seg of segs) {
      let next = node[seg];
      if (next === null || typeof next !== 'object') {
        next = {};
        node[seg] = next;
      }
      node = next as Record<string, unknown>;
    }

    const previous = node[last];
    if (previous === value) return;
    node[last] = value;

    this.enqueue({ path: `$/${key}` as BindingPath, value, previous });
    this.flushIfIdle();
  }

  // --------------------------------------------------------------- batching

  batch<T>(fn: () => T): T {
    this.batchDepth++;
    try {
      return fn();
    } finally {
      this.batchDepth--;
      this.flushIfIdle();
    }
  }

  private enqueue(change: ChangeRecord): void {
    const key = pathKey(change.path);
    const existing = this.pending.get(key);
    // Keep the oldest `previous` so a batch reports one net change.
    this.pending.set(key, existing ? { ...change, previous: existing.previous } : change);
  }

  private flushIfIdle(): void {
    if (this.batchDepth > 0 || this.pending.size === 0) return;

    // Recomputing may enqueue more; drain until quiet, with a runaway guard.
    let rounds = 0;
    while (this.pending.size > 0) {
      if (++rounds > 50) {
        this.onError(new Error('computed paths did not settle after 50 rounds'), 'flush');
        this.pending.clear();
        return;
      }
      const changes = [...this.pending.values()];
      this.pending.clear();

      this.batchDepth++;
      try {
        for (const change of changes) this.recomputeDependents(pathKey(change.path));
      } finally {
        this.batchDepth--;
      }

      for (const change of changes) this.notify(change);
      for (const change of changes) this.schedulePersist(pathKey(change.path));
    }
  }

  private notify(change: ChangeRecord): void {
    const key = pathKey(change.path);
    for (const sub of [...this.subs]) {
      if (!this.subMatches(sub, key)) continue;
      try {
        sub.fn(this.readKey(sub.wildcard ? key : sub.key), change);
      } catch (err) {
        this.onError(err, `subscriber of $/${sub.key}`);
      }
    }
  }

  private subMatches(sub: Subscription, changedKey: string): boolean {
    if (sub.wildcard) return matchKey(changedKey, sub.key, sub.subtree);
    if (sub.key === changedKey) return true;
    // A write below an exact subscription still changes that object's contents.
    if (isDescendantKey(changedKey, sub.key)) return true;
    // A write above it may have replaced the subtree the subscriber reads.
    if (isDescendantKey(sub.key, changedKey)) return true;
    return sub.subtree && ancestorKeys(changedKey).includes(sub.key);
  }

  // ---------------------------------------------------------- subscriptions

  subscribe(
    path: BindingPath,
    fn: (value: unknown, change: ChangeRecord) => void,
    options: SubscribeOptions = {},
  ): Disposable {
    const key = pathKey(path);
    const sub: Subscription = {
      key,
      subtree: options.subtree ?? false,
      wildcard: hasWildcard(key),
      fn,
    };
    this.subs.add(sub);
    this.touchProvider(key);

    if (options.immediate) {
      try {
        const value = this.readKey(key);
        fn(value, { path, value, previous: undefined });
      } catch (err) {
        this.onError(err, `immediate subscriber of ${path}`);
      }
    }

    return toDisposable(() => {
      this.subs.delete(sub);
      this.maybeUnloadProvider(key);
    });
  }

  subscriberCount(scope: ScopeName | string): number {
    let n = 0;
    for (const sub of this.subs) {
      if (sub.key === scope || sub.key.startsWith(scope + '/')) n++;
    }
    return n;
  }

  clearScope(scope: ScopeName | string): void {
    const key = pathKey(scope.startsWith('$/') ? scope : `$/${scope}`);
    const previous = this.readKey(key);
    if (previous === undefined) return;
    const segs = key.split('/');
    const last = segs.pop() as string;
    const parent = segs.length === 0 ? this.root : this.readKey(segs.join('/'));
    if (parent && typeof parent === 'object') {
      delete (parent as Record<string, unknown>)[last];
    }
    this.enqueue({ path: `$/${key}` as BindingPath, value: undefined, previous });
    this.flushIfIdle();
  }

  // -------------------------------------------------------------- computed

  computed<T = unknown>(path: BindingPath, def: ComputedDefinition<T>): Disposable {
    const key = pathKey(path);
    const deps = def.from.map((p) => pathKey(p));
    const select = typeof def.select === 'string'
      ? compileSelect(def.select, def.from)
      : def.select;

    const entry: ComputedEntry = {
      key,
      deps,
      compute: () => {
        const values: Record<string, unknown> = {};
        for (let i = 0; i < def.from.length; i++) {
          const p = def.from[i] as string;
          values[p] = this.readKey(deps[i] as string);
        }
        return select(values);
      },
    };

    this.computedByKey.set(key, entry);
    for (const dep of deps) {
      let set = this.computedDeps.get(dep);
      if (!set) {
        set = new Set();
        this.computedDeps.set(dep, set);
      }
      set.add(key);
    }

    this.recompute(entry);

    return toDisposable(() => {
      this.computedByKey.delete(key);
      for (const dep of deps) this.computedDeps.get(dep)?.delete(key);
    });
  }

  private recompute(entry: ComputedEntry): void {
    try {
      this.writeKey(entry.key, entry.compute());
    } catch (err) {
      this.onError(err, `computed $/${entry.key}`);
    }
  }

  private recomputeDependents(changedKey: string): void {
    for (const [dep, keys] of this.computedDeps) {
      const affected =
        dep === changedKey ||
        isDescendantKey(changedKey, dep) ||
        isDescendantKey(dep, changedKey);
      if (!affected) continue;
      for (const key of keys) {
        const entry = this.computedByKey.get(key);
        if (entry) this.recompute(entry);
      }
    }
  }

  // ------------------------------------------------------------ collections

  collection<T = unknown>(path: BindingPath): CollectionOps<T> {
    const read = (): T[] => {
      const v = this.get<T[]>(path);
      return Array.isArray(v) ? v : [];
    };
    const write = (items: T[]): void => this.set(path, items);

    return {
      all: () => read(),
      at: (index) => read()[index],
      find: (pred) => read().find(pred),
      append: (...items) => write([...read(), ...items]),
      prepend: (...items) => write([...items, ...read()]),
      insertAt: (index, ...items) => {
        const next = read();
        next.splice(index, 0, ...items);
        write(next);
      },
      removeAt: (index) => {
        const next = read();
        if (index < 0 || index >= next.length) return;
        next.splice(index, 1);
        write(next);
      },
      remove: (pred) => {
        const items = read();
        const kept = items.filter((item, i) => !pred(item, i));
        const removed = items.length - kept.length;
        if (removed > 0) write(kept);
        return removed;
      },
      update: (pred, patch) => {
        const items = read();
        let changed = 0;
        const next = items.map((item, i) => {
          if (!pred(item, i)) return item;
          changed++;
          return typeof patch === 'function'
            ? (patch as (item: T) => T)(item)
            : { ...(item as object), ...(patch as object) } as T;
        });
        if (changed > 0) write(next);
        return changed;
      },
      replace: (items) => write([...items]),
      filter: (pred) => read().filter(pred),
      clear: () => write([]),
      cap: (n) => {
        const items = read();
        if (items.length > n) write(items.slice(items.length - n));
      },
      get length() {
        return read().length;
      },
    };
  }

  // -------------------------------------------------------------- providers

  registerDataProvider(def: DataProviderDefinition): Disposable {
    const key = pathKey(def.namespace.startsWith('$/') ? def.namespace : `$/${def.namespace}`);
    const entry: ProviderEntry = { def, loaded: false, loading: null, unloadTimer: null };
    this.providers.set(key, entry);
    if (def.load === 'eager') void this.loadProvider(key);
    return toDisposable(() => {
      if (entry.unloadTimer) clearTimeout(entry.unloadTimer);
      void def.provider.unload?.(this);
      this.providers.delete(key);
    });
  }

  listDataProviders(): DataProviderDefinition[] {
    return [...this.providers.values()].map((e) => e.def);
  }

  /** A read or subscribe below a provider's namespace is what loads it. */
  private touchProvider(key: string): void {
    for (const [ns, entry] of this.providers) {
      if (key !== ns && !isDescendantKey(key, ns)) continue;
      if (entry.unloadTimer) {
        clearTimeout(entry.unloadTimer);
        entry.unloadTimer = null;
      }
      if (!entry.loaded && !entry.loading) void this.loadProvider(ns);
    }
  }

  private async loadProvider(ns: string): Promise<void> {
    const entry = this.providers.get(ns);
    if (!entry || entry.loaded || entry.loading) return;
    const run = (async () => {
      try {
        await entry.def.provider.load(this);
        entry.loaded = true;
      } catch (err) {
        this.onError(err, `data provider ${entry.def.namespace}`);
      } finally {
        entry.loading = null;
      }
    })();
    entry.loading = run;
    await run;
  }

  private maybeUnloadProvider(key: string): void {
    for (const [ns, entry] of this.providers) {
      if (key !== ns && !isDescendantKey(key, ns)) continue;
      const { unloadAfter } = entry.def;
      if (!unloadAfter || !entry.loaded) continue;
      if (this.subscriberCount(ns) > 0) continue;
      if (entry.unloadTimer) clearTimeout(entry.unloadTimer);
      entry.unloadTimer = setTimeout(() => {
        entry.unloadTimer = null;
        if (this.subscriberCount(ns) > 0) return;
        void entry.def.provider.unload?.(this);
        entry.loaded = false;
      }, unloadAfter);
      entry.unloadTimer.unref?.();
    }
  }

  // ---------------------------------------------------- schemas, persistence

  registerSchema(schema: PathSchema): Disposable {
    const key = pathKey(schema.path);
    this.schemas.set(key, schema);
    if (schema.initial !== undefined && this.readKey(key) === undefined) {
      this.writeKey(key, schema.initial);
    }
    return toDisposable(() => this.schemas.delete(key));
  }

  registerPersistence(adapter: PersistenceAdapter): Disposable {
    this.persistence.add(adapter);
    return toDisposable(() => {
      const timer = this.persistTimers.get(adapter.id);
      if (timer) clearTimeout(timer);
      this.persistTimers.delete(adapter.id);
      this.persistence.delete(adapter);
    });
  }

  async hydrate(): Promise<void> {
    for (const adapter of this.persistence) {
      try {
        const entries = await adapter.read();
        this.batch(() => {
          for (const [path, value] of Object.entries(entries)) {
            this.set((path.startsWith('$/') ? path : `$/${path}`) as BindingPath, value);
          }
        });
      } catch (err) {
        this.onError(err, `persistence adapter ${adapter.id}`);
      }
    }
  }

  private schedulePersist(changedKey: string): void {
    for (const adapter of this.persistence) {
      const owns = adapter.paths.some((p) => {
        const key = pathKey(p.startsWith('$/') ? p : `$/${p}`);
        return p.endsWith('/')
          ? changedKey === key || isDescendantKey(changedKey, key)
          : changedKey === key;
      });
      if (!owns) continue;

      const existing = this.persistTimers.get(adapter.id);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        this.persistTimers.delete(adapter.id);
        const entries: Record<string, unknown> = {};
        for (const p of adapter.paths) {
          const key = pathKey(p.startsWith('$/') ? p : `$/${p}`);
          entries[`$/${key}`] = this.readKey(key);
        }
        try {
          void adapter.write(entries);
        } catch (err) {
          this.onError(err, `persistence adapter ${adapter.id}`);
        }
      }, adapter.debounceMs ?? 250);
      timer.unref?.();
      this.persistTimers.set(adapter.id, timer);
    }
  }

  // --------------------------------------------------------------- snapshot

  snapshot(scope?: ScopeName | string): Record<string, unknown> {
    if (!scope) return structuredClone(this.root);
    const key = pathKey(scope.startsWith('$/') ? scope : `$/${scope}`);
    const value = this.readKey(key);
    return value === undefined ? {} : structuredClone({ [key]: value });
  }

  restore(snapshot: Record<string, unknown>): void {
    this.batch(() => {
      for (const [key, value] of Object.entries(snapshot)) {
        this.set(`$/${pathKey(key.startsWith('$/') ? key : `$/${key}`)}` as BindingPath, value);
      }
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const timer of this.persistTimers.values()) clearTimeout(timer);
    this.persistTimers.clear();
    for (const entry of this.providers.values()) {
      if (entry.unloadTimer) clearTimeout(entry.unloadTimer);
      try {
        void entry.def.provider.unload?.(this);
      } catch {
        /* teardown is best effort */
      }
    }
    this.providers.clear();
    this.subs.clear();
    this.computedByKey.clear();
    this.computedDeps.clear();
    this.root = {};
  }
}

/**
 * A computed defined as data. Deliberately tiny: `sum`, `count`, `length`,
 * `first`, `join`, or a path reference. Anything more is a function.
 */
function compileSelect(
  expr: string,
  from: BindingPath[],
): (values: Record<string, unknown>) => unknown {
  const [op, arg] = expr.split(':') as [string, string | undefined];
  const pick = (values: Record<string, unknown>): unknown =>
    values[arg ?? (from[0] as string)];

  switch (op) {
    case 'length':
    case 'count':
      return (v) => {
        const x = pick(v);
        return Array.isArray(x) ? x.length : x == null ? 0 : Object.keys(x as object).length;
      };
    case 'sum':
      return (v) => {
        const x = pick(v);
        return Array.isArray(x) ? x.reduce((a: number, b) => a + Number(b || 0), 0) : 0;
      };
    case 'first':
      return (v) => {
        const x = pick(v);
        return Array.isArray(x) ? x[0] : undefined;
      };
    case 'last':
      return (v) => {
        const x = pick(v);
        return Array.isArray(x) ? x[x.length - 1] : undefined;
      };
    case 'not':
      return (v) => !pick(v);
    case 'join':
      return (v) => {
        const x = pick(v);
        return Array.isArray(x) ? x.join(arg ?? ', ') : '';
      };
    case 'concat':
      return (v) => from.map((p) => String(v[p] ?? '')).join('');
    default:
      // A bare path reference: `$/a/b`.
      return (v) => v[expr];
  }
}

export function createStore(): Store {
  return new Store();
}
