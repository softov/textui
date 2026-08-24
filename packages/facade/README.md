# @textui/kit

Build a terminal UI in TypeScript. One install, one import.

```bash
npm install @textui/kit
```

```tsx
import { render, Box, Text, useState, useInput } from '@textui/kit';

function App() {
  const [count, setCount] = useState(0);
  useInput((e) => { if (e.name === '+') { setCount((c) => c + 1); return true; } });

  return (
    <Box border="round" padding={1} direction="column">
      <Text bold>Count: {count}</Text>
      <Text dim>Press + to increment, ctrl+c to quit</Text>
    </Box>
  );
}

const { waitUntilExit } = render(<App />);
await waitUntilExit();
console.log('App exited');
```

## What this package is

The runtime ([`@textui/core`](https://www.npmjs.com/package/@textui/core)), a terminal to put it on
([`@textui/terminal`](https://www.npmjs.com/package/@textui/terminal)), and `render`. Every other name here is
re-exported from those two - importing from them directly is the same thing
with a longer name.

`render` mounts and keeps running. It returns a handle rather than a promise,
so the application is up before the next line:

| | |
|---|---|
| `app` | Commands, themes, focus, the store - everything hello world did not need |
| `waitUntilExit()` | Resolves when the application stops, however it stopped |
| `unmount()` | Stop, put the terminal back, resolve `waitUntilExit` |
| `rerender(node)` | Swap the root |

For one frame and no terminal - a report, `--help`, a test - use `renderOnce`
or `renderToString` instead. Those return; this one runs.

## ctrl+c

Handled, and it has to be handled as a **key rather than a signal**. The
terminal is in raw mode from the moment the app starts, and raw mode is
exactly the mode where ctrl+c stops being SIGINT and becomes the byte `0x03` -
so process signal handlers never fire.

`exitOnCtrlC: false` gives you the key instead, which is what an editor with
unsaved work wants.

## Components

The catalog is a separate install:

```bash
npm install @textui/widgets
```

```tsx
import { Card, Badge } from '@textui/widgets';
```

Nothing to register. `<Card/>` compiles to a node that carries the imported
function, and the runtime uses that in preference to any registry - so
importing a component *is* registering it. That is why the catalog is not
bundled here: a screen made of `Box` and `Text` should not carry eighty
components it never mentions.

The one case that needs a registry is a screen named in data, where a string
has to resolve to something:

```tsx
import { registerBuiltins } from '@textui/widgets';

render(<App />, { onBoot: registerBuiltins });
```

## Runtime

No dependencies outside the two packages it re-exports, and no `node:` imports
of its own. Node 22+ and Bun.

## Documentation

<https://softov.github.io/textui/>

<!-- family -->

---

Part of **[TextUI](https://github.com/softov/textui)** - [documentation](https://softov.github.io/textui/) - [getting started](https://softov.github.io/textui/getting-started.html)

**`@textui/kit`** one install · [`@textui/core`](https://www.npmjs.com/package/@textui/core) the runtime · [`@textui/widgets`](https://www.npmjs.com/package/@textui/widgets) the catalog · [`@textui/terminal`](https://www.npmjs.com/package/@textui/terminal) adapters and input · [`@textui/testing`](https://www.npmjs.com/package/@textui/testing) the harness · [`@textui/cli`](https://www.npmjs.com/package/@textui/cli) the CLI
