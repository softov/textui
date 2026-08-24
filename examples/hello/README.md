# hello

The smallest textui program: a bordered box, two lines of text, and a way out.

```bash
node index.ts        # or: bun index.ts
```

No build step. `h` is what JSX compiles to - `<Box border="round"/>` and
`{ component: 'box', border: 'round' }` are the same value - so this file is
already in the form the runtime reads, and node has stripped types by default
since 23.6.

`render` returns a handle rather than a promise, so the application is up
before the next line runs. `waitUntilExit()` waits for it to end, and ctrl+c is
what ends it.

For the same idea written in JSX, see [`counter`](../counter), which ships both
spellings side by side.
