# Store and events

One reactive tree, addressed by JSON-Pointer-shaped paths, and the only place state lives.

## Paths

```
$/services/list          absolute; the first segment is a scope
/name                    relative to the surrounding data context
$/services/*/status      a wildcard, in subscriptions only
#/config/activePath      the value AT this path is itself a path
$/rows/{{ $/active/id }} another path's value, substituted first
```

`..` is forbidden. Escape to the root with `$/` instead, so a node's meaning never depends on where it was pasted.

## Scopes are lifetimes

| Scope | Dies when |
| --- | --- |
| `local` | the mount goes away |
| `screen` | the screen is popped |
| `session` | the process ends |
| `app` | the application clears it |
| `global` | never, as far as the application is concerned |
| `summary` | derived counts; recomputed, never written by hand |
| `active` | selection, application-wide |
| `ui` | chrome state: collapsed, expanded, scrolled |
| `layout` | surfaces, mounts, the active shell |
| `modus` | the environment: size, capabilities, locale |

`clearScope('session')` is what makes signing out one call rather than a cascade of resets.

## Reading and writing

```ts
store.set('$/services/list', services);
store.get<Service[]>('$/services/list');
store.read('$/config/timeout', 30);          // with a fallback
store.update<number>('$/counter', (n) => (n ?? 0) + 1);
store.patch('$/config', { timeout: 60 });    // shallow merge
store.patchMany({ '$/a': 1, '$/b': 2 });     // one notification pass
store.delete('$/scratch');
```

`batch` coalesces every write inside it into a single notification pass:

```ts
store.batch(() => {
  for (const service of services) store.set(`$/services/byId/${service.id}`, service);
});
```

## Subscriptions

```ts
store.subscribe('$/services/list', (value) => {});                    // exact
store.subscribe('$/metrics', (value) => {}, { subtree: true });       // and below
store.subscribe('$/services/*/status', (value) => {});                // wildcard
store.subscribe('$/theme', fn, { immediate: true });                  // fire now too
```

An exact subscriber also fires when something below it changes, because a write to `$/a/b` does change the object at `$/a`.

## Computed

```ts
store.computed('$/summary/services/down', {
  from: ['$/services/list'],
  select: (values) => (values['$/services/list'] as Service[]).filter((s) => s.status === 'down').length,
});
```

A computed defined as *data* uses the tiny select language - `count`, `sum`, `first`, `last`, `join:, `, `not`, `concat` - so a computed path can live in a manifest rather than in code:

```ts
store.computed('$/summary/alerts', { from: ['$/alerts/list'], select: 'count' });
```

## Collections

```ts
const log = store.collection<LogLine>('$/logs/lines');

log.append(line);
log.cap(500);                                  // keep the last 500
log.update((l) => l.id === id, { level: 'error' });
log.remove((l) => l.level === 'debug');
```

`cap` is the one that matters for a log tail: without it a long-running application grows until it stops.

## Data providers

A namespace and the code that fills it. Lazy by default: nothing loads until something reads or subscribes below it.

```ts
store.registerDataProvider({
  namespace: 'services',
  unloadAfter: 30_000,        // unload when nothing has watched for 30s
  provider: {
    async load(store) {
      store.set('$/services/list', await fetchServices());
    },
    unload(store) {
      store.delete('$/services/list');
    },
  },
});
```

## Schemas and persistence

```ts
store.registerSchema({
  path: '$/config/port',
  validate: (v) => (typeof v === 'number' ? null : 'expected a number'),
  initial: 8080,
});

store.registerPersistence({
  id: 'ui',
  paths: ['$/ui/', '$/layout/surfaces/'],   // a trailing slash means the subtree
  read: () => JSON.parse(readFileSync(path, 'utf8')),
  write: (entries) => writeFileSync(path, JSON.stringify(entries)),
  debounceMs: 500,
});

await store.hydrate();   // once, at boot
```

Schemas are optional and dynamic paths stay legal either way - the point is to catch a wrong write where it happens, not to make the store typed.

## In components

```tsx
const [name, setName] = useStore<string>('$/agent/name', 'billing-worker');
const services = useStoreValue<Service[]>('$/services/list', []);
const metrics = useStoreSubtree('$/metrics');
const alerts = useCollection<Alert>('$/alerts/list');
```

Each subscribes to exactly the path it names, so a hundred-row list does not re-render because an unrelated counter moved.

### `useStore` is state; `useStoreValue` is a view

They look similar and their second arguments mean different things, so the distinction is worth stating plainly:

| | second argument | writes? | other readers see it |
|---|---|---|---|
| `useStore(path, initial)` | an initial value | yes, once, if the path is empty | yes |
| `useStoreValue(path, fallback)` | what *this* reader shows while empty | never | no |

`useStore` is named after `useState` and behaves like it: the initial value is written the first time a component asks for a path that nothing has filled in, so every other reader of that path agrees with it immediately. Use it where a component owns a piece of state that happens to live in the store.

`useStoreValue` is for reading something another part of the application owns. Its fallback is a display default - `0` for a count nobody has computed yet - and it stays local to that one component. If two components pass different fallbacks for the same empty path, they show different things, which is exactly what "this is not shared" means.

When state is owned by nothing in particular - defaults for a screen, seeds for a demo - write it at boot or declare it with `registerSchema({ initial })`, which is clearer than making some component's first render responsible for it.

## Events

Transient, addressed the same way, deliberately a different mechanism:

```ts
events.emit('@/agent/restart', { id: 'billing' });
events.on('@/agent/restart', (payload) => {});
events.on('@/agent', handler, { subtree: true });
await events.next('@/dialog/confirm', 5000);
```

An event has no value to read back. If something needs to be *read* later, it is state and belongs in the store.
