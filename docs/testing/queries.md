---
title: Query by meaning, not by ANSI
parent: Testing
nav_order: 1
---

# Query by meaning, not by ANSI

Queries are semantic first, because a test pinned to exact escape sequences fails
on every legitimate change and passes on none of the interesting bugs.

```ts
t.getByRole('button', { name: 'Restart' });
t.getAllByRole('listitem');
t.getByLabel('Password');
t.getByText('billing-worker');
t.getByComponent('Table');
t.queryByRole('dialog');          // null rather than throwing
```

A missing match prints the frame. An ambiguous one lists what matched and asks
you to narrow it, rather than silently picking the first.
