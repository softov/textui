# @textui/terminal

What [`@textui/core`](../core) needs to reach an actual terminal: adapters,
capability detection, ANSI writing and input decoding.

```bash
npm install @textui/terminal
```

```ts
import { createApp } from '@textui/core';
import { createNodeTerminal } from '@textui/terminal';

const app = createApp({ terminal: createNodeTerminal(), root: <App /> });
await app.start();
```

## Two adapters

`createNodeTerminal()` is the real one - stdin, stdout, resize, and the signal
handling that puts the screen back the way it found it when the process dies.

`createVirtualTerminal()` has no tty at all. It is what the test harness and
`--static` run on, and it is the reason a component that only works
interactively is a component nobody can test cheaply.

## Capabilities are detected, and can be lied to

Unicode level, colour depth, mouse, hyperlinks, the kitty keyboard protocol -
detection is right almost always, and the times it is not are the times nobody
is watching. So every capability can be forced, which is how you see the
terminal somebody else is sitting at:

```ts
createNodeTerminal({ capabilities: { unicode: 'ascii', colors: 4 } });
```

Under the kitty protocol, `ctrl+shift+f` is a distinct stroke from `ctrl+f`.
Without it the terminal sends the same byte for both, and no amount of decoding
recovers the difference.

## What it needs from a stream

`TerminalInput` and `TerminalOutput`, which say what the adapter uses rather
than which stream it is - `setRawMode`, `columns`, `write`, and half a dozen
more. `process.stdin` and `process.stdout` satisfy them, so nothing changes for
a caller, and so do the streams of runtimes that are not node.

That is also why the published types name no Node interfaces: a package with no
dependencies should not need `@types/node` installed to compile.

## Runtime

No dependencies beyond `@textui/core`. Uses `process` for stdio and signals, and
no other Node API. Node 22+ and Bun.

## Documentation

<https://softov.github.io/textui/>
