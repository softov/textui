---
title: Computed and collections
parent: Store
nav_order: 3
---

<!-- docs:setup
import type { ReactiveStore } from '@textui/core';
declare const store: ReactiveStore;
type LogLine = { id: string; message: string; level: 'debug' | 'info' | 'warn' | 'error' };
declare const id: string;
declare const line: LogLine;
type Service = { id: string; name: string; status: string };
-->

# Computed and collections

Two things that layer on top of a plain path: a value derived from other paths,
and a list with the operations a list actually needs.

## Computed

```ts
store.computed('$/summary/services/down', {
  from: ['$/services/list'],
  select: (values) => (values['$/services/list'] as Service[]).filter((s) => s.status === 'down').length,
});
```

A computed defined as *data* uses the tiny select language - `count`, `sum`,
`first`, `last`, `join:, `, `not`, `concat` - so a computed path can live in a
manifest rather than in code:

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

`cap` is the one that matters for a log tail: without it a long-running
application grows until it stops.
