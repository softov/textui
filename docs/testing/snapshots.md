---
title: Structure and snapshots
parent: Testing
nav_order: 4
---

# Structure and snapshots

```ts
t.tree();                         // the semantic tree
t.lines();                        // the frame, row by row
t.errors();                       // anything the runtime caught
t.stats();                        // renders, runs, mounted instances

expect(snapshot(t)).toMatchSnapshot();
expect(snapshot(t, { ruler: true })).toMatchSnapshot();   // with a column ruler
```

`stats().runs` is how many terminal writes the last frame cost. If a one-cell
change reports a hundred runs, the diff has stopped working - which is a test
worth writing for anything performance-sensitive.

## What the playgrounds assert

`playground/test/playgrounds.test.tsx` is the pattern worth copying. For every
playground it mounts it, asserts it rendered something, asserts no unregistered
component leaked through, resizes to 40 columns, strips Unicode and colour away,
and renders it statically with no application at all.

A showcase nobody checks is a showcase that rots: someone changes a default, the
gallery renders an empty box, and nobody notices for a month.
