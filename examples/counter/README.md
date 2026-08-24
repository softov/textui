# counter

Keys, state, and a timer you can pause.

```bash
node index.ts        # or: bun index.ts
```

| | |
|---|---|
| `+` / `-` | Add or subtract one. `=` is `+` unshifted, and does the same |
| `space` | Start or stop counting up |
| `r` | Reset |
| `ctrl+c` | Quit |

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
