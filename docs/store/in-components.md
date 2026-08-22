---
title: In components
parent: Store
nav_order: 5
---

<!-- docs:setup
import { useCollection, useStore, useStoreSubtree, useStoreValue } from '@textui/core';
type Alert = { id: string; message: string };
type Service = { id: string; name: string; status: string };
-->

# In components

Four hooks, each subscribing to exactly the path it names - so a hundred-row
list does not re-render because an unrelated counter moved.

```tsx
const [name, setName] = useStore<string>('$/agent/name', 'billing-worker');
const services = useStoreValue<Service[]>('$/services/list', []);
const metrics = useStoreSubtree('$/metrics');
const alerts = useCollection<Alert>('$/alerts/list');
```

## `useStore` is state; `useStoreValue` is a view

They look similar and their second arguments mean different things, so the
distinction is worth stating plainly:

| | second argument | writes? | other readers see it |
|---|---|---|---|
| `useStore(path, initial)` | an initial value | yes, once, if the path is empty | yes |
| `useStoreValue(path, fallback)` | what *this* reader shows while empty | never | no |

`useStore` is named after `useState` and behaves like it: the initial value is
written the first time a component asks for a path that nothing has filled in,
so every other reader of that path agrees with it immediately. Use it where a
component owns a piece of state that happens to live in the store.

`useStoreValue` is for reading something another part of the application owns.
Its fallback is a display default - `0` for a count nobody has computed yet -
and it stays local to that one component. If two components pass different
fallbacks for the same empty path, they show different things, which is exactly
what "this is not shared" means.

When state is owned by nothing in particular - defaults for a screen, seeds for
a demo - write it at boot or declare it with `registerSchema({ initial })`,
which is clearer than making some component's first render responsible for it.
