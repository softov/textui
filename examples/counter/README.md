# counter

Keys, state, and a timer you can pause. The same program twice: once in plain
`h`, once in JSX.

```bash
node index.ts        # or: bun index.ts
bun counter.tsx      # the same program, in JSX
```

Both render the same screen. Neither is built.

| | |
|---|---|
| `+` / `-` | Add or subtract one. `=` is `+` unshifted, and does the same |
| `space` | Start or stop counting up |
| `r` | Reset |
| `ctrl+c` | Quit |

## Why two files

`h` is what JSX compiles to - `<Box border="round"/>` and
`{ component: 'box', border: 'round' }` are the same value - so `index.ts` is
already in the form the runtime reads. Node has stripped types by default since
23.6, which makes it a file node runs with nothing in between.

`counter.tsx` needs bun, and the reason is not a missing flag. **Node strips
types; it does not transform syntax.** An annotation can be deleted; `<Box/>`
has to *become* a call. Node rejects the extension outright:

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

**The JSX file is not called `index.tsx`, and it cannot be.** TypeScript
expands `include` with an extension preference, and `.ts` beats `.tsx` for the
same basename - so an `index.ts` beside an `index.tsx` silently drops the
`.tsx` from the project. No error, no warning: `tsc` reports success without
ever reading it, and the editor, finding the file in no project at all, falls
back to its implicit one and compiles the JSX as React:

```
This JSX tag requires the module path 'react/jsx-runtime' to exist
```

Two files, two basenames.

## What it is showing

**`useKeymap`.** Keys are written as the same strings the keybinding registry
uses, so a stroke is `'ctrl+s'` rather than four comparisons against a
`KeyEvent` and a bug the first time somebody forgets that shift is implied by
an uppercase letter.

```ts
useKeymap({
  '+': () => { setCount((c) => c + 1); },
  space: () => { setRunning((r) => !r); },
});
```

It is global by default, unlike `useInput` - a component that lists the keys it
wants rarely also wants them to stop working when focus moves.

**`useInterval`'s third argument.** Space flips a boolean, and that boolean is
whether the interval exists - not whether a running interval is ignored. There
is no timer at all while it is stopped.

**ctrl+c.** Handled by `render`, and it has to be handled as a key rather than
a signal: the terminal is in raw mode, which is exactly the mode where ctrl+c
stops being SIGINT and becomes the byte `0x03`.
