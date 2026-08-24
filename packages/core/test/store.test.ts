import { describe, expect, it, vi } from 'vitest';
import { createStore } from '../src/core/store.js';
import { escapeSegment } from '../src/util/paths.js';
import type { BindingPath } from '../src/types/graph.js';

describe('read and write', () => {
  it('writes and reads a nested path, creating intermediates', () => {
    const store = createStore();
    store.set('$/statusbar/agent/name', 'billing-worker');
    expect(store.get('$/statusbar/agent/name')).toBe('billing-worker');
    expect(store.get('$/statusbar/agent')).toEqual({ name: 'billing-worker' });
  });

  it('read falls back without writing to the store', () => {
    const store = createStore();
    expect(store.read('$/missing/thing', 7)).toBe(7);
    expect(store.has('$/missing/thing')).toBe(false);
  });

  it('update receives the current value', () => {
    const store = createStore();
    store.set('$/metrics/count', 1);
    store.update<number>('$/metrics/count', (n) => (n ?? 0) + 1);
    expect(store.get('$/metrics/count')).toBe(2);
  });

  it('rejects a wildcard write', () => {
    const store = createStore();
    expect(() => store.set('$/a/*/c' as never, 1)).toThrow(/wildcard/);
  });

  it('rejects ".." in a path', () => {
    const store = createStore();
    expect(() => store.set('$/a/../b' as never, 1)).toThrow(/forbidden/);
  });

  it('deletes a key', () => {
    const store = createStore();
    store.set('$/a/b', 1);
    store.delete('$/a/b');
    expect(store.get('$/a/b')).toBeUndefined();
    expect(store.get('$/a')).toEqual({});
  });
});

describe('subscriptions', () => {
  it('fires on an exact path', () => {
    const store = createStore();
    const seen = vi.fn();
    store.subscribe('$/a/b', seen);
    store.set('$/a/b', 1);
    expect(seen).toHaveBeenCalledTimes(1);
    expect(seen.mock.calls[0]![0]).toBe(1);
  });

  it('does not fire for an unrelated sibling', () => {
    const store = createStore();
    const seen = vi.fn();
    store.subscribe('$/a/b', seen);
    store.set('$/a/c', 1);
    expect(seen).not.toHaveBeenCalled();
  });

  it('fires an exact subscriber when a child changes', () => {
    const store = createStore();
    const seen = vi.fn();
    store.subscribe('$/a', seen);
    store.set('$/a/b', 1);
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it('fires a subtree subscriber for anything below', () => {
    const store = createStore();
    const seen = vi.fn();
    store.subscribe('$/metrics', seen, { subtree: true });
    store.set('$/metrics/cpu/history', [1, 2, 3]);
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it('matches wildcard segments', () => {
    const store = createStore();
    const seen = vi.fn();
    store.subscribe('$/services/*/status' as never, seen);
    store.set('$/services/api/status', 'up');
    store.set('$/services/auth/status', 'down');
    store.set('$/services/api/cpu', 12);
    expect(seen).toHaveBeenCalledTimes(2);
  });

  it('delivers immediately when asked', () => {
    const store = createStore();
    store.set('$/a', 5);
    const seen = vi.fn();
    store.subscribe('$/a', seen, { immediate: true });
    expect(seen).toHaveBeenCalledWith(5, expect.anything());
  });

  it('stops after dispose', () => {
    const store = createStore();
    const seen = vi.fn();
    store.subscribe('$/a', seen).dispose();
    store.set('$/a', 1);
    expect(seen).not.toHaveBeenCalled();
  });

  it('reports a listener error without losing the write', () => {
    const store = createStore();
    const errors: string[] = [];
    store.onError = (_e, ctx) => errors.push(ctx);
    store.subscribe('$/a', () => { throw new Error('boom'); });
    store.set('$/a', 1);
    expect(store.get('$/a')).toBe(1);
    expect(errors).toHaveLength(1);
  });
});

describe('batching', () => {
  it('coalesces repeated writes into one notification per path', () => {
    const store = createStore();
    const seen = vi.fn();
    store.subscribe('$/a', seen, { subtree: true });
    store.batch(() => {
      store.set('$/a/x', 1);
      store.set('$/a/x', 2);
      store.set('$/a/y', 3);
    });
    expect(seen).toHaveBeenCalledTimes(2);
    expect(store.get('$/a/x')).toBe(2);
  });

  it('patchMany is a single batch', () => {
    const store = createStore();
    const seen = vi.fn();
    store.subscribe('$/cfg', seen, { subtree: true });
    store.patchMany({ '$/cfg/a': 1, '$/cfg/b': 2 });
    expect(seen).toHaveBeenCalledTimes(2);
  });
});

describe('computed', () => {
  it('derives from other paths and recomputes', () => {
    const store = createStore();
    store.set('$/tickets/list', [1, 2, 3]);
    store.computed('$/summary/tickets/total', {
      from: ['$/tickets/list'],
      select: (v) => (v['$/tickets/list'] as number[]).length,
    });
    expect(store.get('$/summary/tickets/total')).toBe(3);
    store.set('$/tickets/list', [1]);
    expect(store.get('$/summary/tickets/total')).toBe(1);
  });

  it('supports the data-defined select shorthand', () => {
    const store = createStore();
    store.set('$/alerts/list', ['a', 'b']);
    store.computed('$/summary/alerts/count', { from: ['$/alerts/list'], select: 'count' });
    expect(store.get('$/summary/alerts/count')).toBe(2);
  });

  it('notifies subscribers of the computed path', () => {
    const store = createStore();
    const seen = vi.fn();
    store.set('$/n', 1);
    store.computed('$/double', { from: ['$/n'], select: (v) => (v['$/n'] as number) * 2 });
    store.subscribe('$/double', seen);
    store.set('$/n', 5);
    expect(store.get('$/double')).toBe(10);
    expect(seen).toHaveBeenCalled();
  });

  it('stops recomputing after dispose', () => {
    const store = createStore();
    store.set('$/n', 1);
    const d = store.computed('$/double', { from: ['$/n'], select: (v) => (v['$/n'] as number) * 2 });
    d.dispose();
    store.set('$/n', 4);
    expect(store.get('$/double')).toBe(2);
  });
});

describe('collections', () => {
  it('appends, updates, removes and caps', () => {
    const store = createStore();
    const log = store.collection<{ id: number; level: string }>('$/log/lines');
    log.append({ id: 1, level: 'info' }, { id: 2, level: 'warn' });
    expect(log.length).toBe(2);

    log.update((l) => l.id === 1, { level: 'error' });
    expect(log.at(0)!.level).toBe('error');

    log.remove((l) => l.level === 'warn');
    expect(log.length).toBe(1);

    log.append({ id: 3, level: 'info' }, { id: 4, level: 'info' }, { id: 5, level: 'info' });
    log.cap(2);
    expect(log.all().map((l) => l.id)).toEqual([4, 5]);
  });

  it('notifies subscribers of the collection path', () => {
    const store = createStore();
    const seen = vi.fn();
    store.subscribe('$/summary/alerts/list', seen);
    store.collection('$/summary/alerts/list').append('one');
    expect(seen).toHaveBeenCalledTimes(1);
  });
});

describe('scopes', () => {
  it('clearScope removes a whole namespace at once', () => {
    const store = createStore();
    store.set('$/session/token', 'abc');
    store.set('$/session/user/name', 'softov');
    store.set('$/app/keep', 1);
    store.clearScope('session');
    expect(store.get('$/session/token')).toBeUndefined();
    expect(store.get('$/app/keep')).toBe(1);
  });

  it('counts subscribers per scope', () => {
    const store = createStore();
    store.subscribe('$/metrics/cpu', () => {});
    store.subscribe('$/metrics/mem', () => {});
    expect(store.subscriberCount('metrics')).toBe(2);
  });
});

describe('data providers', () => {
  it('is lazy: nothing loads until something reads', async () => {
    const store = createStore();
    const load = vi.fn((s: typeof store) => { s.set('$/remote/value', 42); });
    store.registerDataProvider({ namespace: 'remote', provider: { load } });
    expect(load).not.toHaveBeenCalled();

    store.get('$/remote/value');
    await Promise.resolve();
    expect(load).toHaveBeenCalledTimes(1);
    expect(store.get('$/remote/value')).toBe(42);
  });

  it('loads eagerly when asked', async () => {
    const store = createStore();
    const load = vi.fn();
    store.registerDataProvider({ namespace: 'eagerns', load: 'eager', provider: { load } });
    await Promise.resolve();
    expect(load).toHaveBeenCalled();
  });
});

describe('schemas and snapshots', () => {
  it('rejects a value the schema refuses', () => {
    const store = createStore();
    store.registerSchema({
      path: '$/cfg/port',
      validate: (v) => (typeof v === 'number' ? null : 'expected a number'),
    });
    expect(() => store.set('$/cfg/port', 'nope')).toThrow(/expected a number/);
    store.set('$/cfg/port', 8080);
    expect(store.get('$/cfg/port')).toBe(8080);
  });

  it('seeds the initial value', () => {
    const store = createStore();
    store.registerSchema({ path: '$/cfg/theme', validate: () => null, initial: 'dark' });
    expect(store.get('$/cfg/theme')).toBe('dark');
  });

  it('round-trips a snapshot', () => {
    const store = createStore();
    store.set('$/ui/sidebar/collapsed', true);
    const snap = store.snapshot();

    const other = createStore();
    other.restore(snap);
    expect(other.get('$/ui/sidebar/collapsed')).toBe(true);
  });
});

describe('a segment that contains a slash', () => {
  it('survives set and get as one segment', () => {
    const store = createStore();
    const uri = 'file:///home/x/notes.md';
    const path: BindingPath = `$/session/documents/${escapeSegment(uri)}`;

    store.set(path, { uri, content: 'hello' });

    expect(store.get<{ content: string }>(path)?.content).toBe('hello');
    // One key, not a directory tree built out of the URI.
    expect(Object.keys(store.get<object>('$/session/documents') ?? {})).toHaveLength(1);
  });

  it('notifies a subscriber on that exact path', () => {
    const store = createStore();
    const path: BindingPath = `$/session/documents/${escapeSegment('file:///a/b')}`;
    const seen: unknown[] = [];
    store.subscribe(path, (value) => seen.push(value));

    store.set(path, 'one');
    expect(seen).toEqual(['one']);
  });

  it('does not confuse two URIs that share a prefix', () => {
    const store = createStore();
    const a: BindingPath = `$/session/documents/${escapeSegment('file:///a/b')}`;
    const b: BindingPath = `$/session/documents/${escapeSegment('file:///a/b/c')}`;

    store.set(a, 'first');
    store.set(b, 'second');

    expect(store.get(a)).toBe('first');
    expect(store.get(b)).toBe('second');
  });
});

/**
 * Persisting a subtree.
 *
 * `paths` says "subtree if it ends in `/`", and a trailing slash survived into
 * the key it was turned into - so `$/a/b/` matched neither `$/a/b` nor
 * anything under it, and every subtree adapter ever registered was inert. The
 * exact-path form worked, which is why nothing noticed.
 */
describe('persistence', () => {
  const adapter = (paths: string[], writes: Record<string, unknown>[]) => ({
    id: 'test',
    paths,
    debounceMs: 1,
    read: () => ({}),
    write: (entries: Record<string, unknown>) => { writes.push(entries); },
  });

  const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

  it('writes when something inside the subtree changes', async () => {
    const writes: Record<string, unknown>[] = [];
    const store = createStore();
    store.registerPersistence(adapter(['$/todo/tasks/'], writes));

    store.set('$/todo/tasks/t1' as BindingPath, { id: 't1' });
    await settle();

    // The whole subtree, under the path without its slash - which is the path
    // `hydrate` will set it back to.
    expect(writes).toEqual([{ '$/todo/tasks': { t1: { id: 't1' } } }]);
    store.dispose();
  });

  it('still writes for an exact path', async () => {
    const writes: Record<string, unknown>[] = [];
    const store = createStore();
    store.registerPersistence(adapter(['$/todo/settings'], writes));

    store.set('$/todo/settings' as BindingPath, { dark: true });
    await settle();
    expect(writes).toEqual([{ '$/todo/settings': { dark: true } }]);

    // ...and not for something merely underneath it.
    writes.length = 0;
    store.set('$/todo/settings/dark' as BindingPath, false);
    await settle();
    expect(writes).toEqual([]);
    store.dispose();
  });

  it('reads back into the path the entry names', async () => {
    const store = createStore();
    store.registerPersistence({
      id: 'r',
      paths: ['$/todo/tasks/'],
      read: () => ({ '$/todo/tasks': { t9: { id: 't9' } } }),
      write: () => {},
    });

    await store.hydrate();
    expect(store.get('$/todo/tasks/t9' as BindingPath)).toEqual({ id: 't9' });
    store.dispose();
  });
});
