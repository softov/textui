---
title: Providers
parent: Documents
nav_order: 1
---

# Providers

One per URI scheme.

```ts
app.resources.registerProvider({
  scheme: 'service',
  async stat(uri) {
    const service = await lookup(uri);
    return service && {
      uri,
      kind: 'service',
      metadata: { name: service.name },
      capabilities: ['read', 'watch'],
    };
  },
  async list(uri) { … },
  async read(uri) { … },
  async write(uri, content) { … },
});
```

A provider may return `kind: 'unknown'` and leave classification to the registry,
which keeps the rules in one place.
