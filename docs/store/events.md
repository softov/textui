---
title: Events
parent: Store
nav_order: 6
---

# Events

Transient, addressed the same way as store paths, and deliberately a different
mechanism.

```ts
events.emit('@/agent/restart', { id: 'billing' });
events.on('@/agent/restart', (payload) => {});
events.on('@/agent', handler, { subtree: true });
await events.next('@/dialog/confirm', 5000);
```

An event has no value to read back. If something needs to be *read* later, it
is state and belongs in the store.
