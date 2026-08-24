# hello

The smallest textui program, written twice: once in plain `h`, once in JSX.

```bash
node index.ts        # or: bun index.ts
bun index.tsx        # the same program, in JSX
```

Both files render the same thing. Neither is built.

## Why two

`h` is what JSX compiles to - `<Box border="round"/>` and
`{ component: 'box', border: 'round' }` are the same value - so `index.ts` is
already in the form the runtime reads. Node has stripped types by default since
23.6, which makes it a file node runs with nothing in between.

`index.tsx` needs bun, and the reason is not a missing flag. **Node strips
types; it does not transform syntax.** An annotation can be deleted; `<Box/>`
has to *become* a call. Node rejects the extension before any flag applies:

```
TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".tsx"
```

`--experimental-transform-types` does not change it - that handles enums and
namespaces, not JSX.

The whole setup for the JSX side is one line of `tsconfig.json`:

```json
{ "compilerOptions": { "jsxImportSource": "textui" } }
```

Pointed at `textui` rather than `@textui/core`, so one install is enough - the
facade re-exports the JSX runtime for exactly this.

## The shape

`render` returns a handle rather than a promise, so the application is up
before the next line runs. `waitUntilExit()` waits for it to end, and ctrl+c is
what ends it.
