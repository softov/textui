---
title: Reading and writing
parent: Store
nav_order: 2
---

# Reading and writing

The store's own API, for code outside a component. Inside one, use the hooks in
[In components](in-components.md) instead - they subscribe for you.

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

An exact subscriber also fires when something below it changes, because a write
to `$/a/b` does change the object at `$/a`.
