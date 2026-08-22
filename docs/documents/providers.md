---
title: Providers
parent: Documents
nav_order: 1
---

<!-- docs:setup
declare function lookup(uri: string): Promise<{ name: string } | null>;
declare const app: import('@textui/core').TextUIApp;
-->

# Providers

One per URI scheme. Register one and every resource under that scheme is
reachable through `app.resources`, which is the only thing callers touch -
there is no public path to a provider, and a caller that found one would be
hardcoding a scheme.

```ts
import type { Resource } from '@textui/core';

app.resources.registerProvider({
  scheme: 'service',
  async stat(uri): Promise<Resource | null> {
    const service = await lookup(uri);
    if (!service) return null;
    return {
      uri,
      kind: 'service',
      metadata: { name: service.name },
      capabilities: ['read', 'watch'],
    };
  },
  read: async (uri) => `${uri} is up`,
  watch: (_uri, fn) => {
    const timer = setInterval(() => fn('change'), 1000);
    return { dispose: () => clearInterval(timer) };
  },
});
```

`stat` is the only method a provider must have. A provider may return
`kind: 'unknown'` and leave classification to the registry, which keeps the
rules in one place.

## What the registry forwards

Everything a provider can offer: `stat`, `list`, `read`, `write`, `delete`,
`rename` and `watch`. Which means the caller writes the same line whether the
file is on this disk or on a machine somewhere else - only the scheme differs,
and the scheme is what picks the provider.

<!-- docs:local
declare const uri: string;
-->

```ts
await app.resources.delete(uri);
```

## What happens when a provider cannot

Two answers, and the split is intent rather than convenience:

| | unimplemented |
|---|---|
| `list`, `watch` | answers emptily - `[]`, and a disposable that does nothing |
| `read`, `write`, `delete`, `rename` | throws |

An absent listing is a fact about the resource. An absent delete is a request
that did not happen, and it has to be heard: a Delete that appears in a menu
and removes nothing is the worst outcome available, and it is what an optional
call - `resources.delete?.(uri)` - quietly produces.

A rename is within one scheme. Across two it throws, because that is a copy
and a delete and belongs above a registry that dispatches on a single scheme
by construction.

## Asking before you call

`Resource.capabilities` is what decides whether to *offer* an action.

<!-- docs:local
declare const uri: string;
-->

```ts
const resource = await app.resources.stat(uri);
if (resource?.capabilities.includes('delete')) {
  await app.resources.delete(uri);
}
```

It is per resource rather than per provider, so a read-only mount, a file the
user has no permission on and something inherently immutable all come back the
same shape - and a caller deciding whether to draw a Delete never has to know
which of the three it is looking at.

The throw is still there for the race that asking cannot close: the remote
goes away, the permission changes, between the offer and the call.
