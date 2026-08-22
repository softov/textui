---
title: Providers and persistence
parent: Store
nav_order: 4
---

<!-- docs:setup
import { readFileSync, writeFileSync } from 'node:fs';
import type { ReactiveStore } from '@textui/core';
declare const store: ReactiveStore;
declare const path: string;
declare const fetchServices: () => Promise<unknown>;
-->

# Providers and persistence

Where a namespace gets its values from, and which of them survive a restart.

## Data providers

A namespace and the code that fills it. Lazy by default: nothing loads until
something reads or subscribes below it.

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

Schemas are optional and dynamic paths stay legal either way - the point is to
catch a wrong write where it happens, not to make the store typed.
