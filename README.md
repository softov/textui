# TextUI

[![npm](https://img.shields.io/npm/v/@textui/kit?label=%40textui%2Fkit)](https://www.npmjs.com/package/@textui/kit)
[![node](https://img.shields.io/node/v/@textui/kit)](https://nodejs.org)
[![dependencies](https://img.shields.io/badge/dependencies-none-brightgreen)](#zero-dependencies)
[![license](https://img.shields.io/npm/l/@textui/kit)](LICENSE)

A dependency-free TypeScript terminal UI runtime. Screens are plain data; JSX is one way to write them.

```bash
npm install @textui/kit
```

```tsx
import { Box, Text, render, useInput, useState } from '@textui/kit';

function Counter() {
  const [count, setCount] = useState(0);

  useInput((e) => {
    if (e.name !== '+') return false;

    setCount((c) => c + 1);
    return true;
  });

  return (
    <Box border="round" padding={1} direction="column">
      <Text bold>Count: {count}</Text>
      <Text dim>+ to increment, ctrl+c to quit</Text>
    </Box>
  );
}

const { waitUntilExit } = render(<Counter />);
await waitUntilExit();
```

> **Status:** pre-1.0. The surface is still moving.

## A quick taste

*Let's cut to the chase, shall we?*

<p align="center">
  <img src="./media/print-theme-dark.svg" alt="TextUI dark theme" />
</p>

TextUI can go from a small interactive prompt to a full-screen terminal application.

&rarr; **[Get started](docs/getting-started.md)**
&rarr; **[Read the documentation](https://softov.github.io/textui/)**

## The one idea

**JSX compiles to data.**

```tsx
<Row gap={1}>
  <Text>Hello</Text>
</Row>
```

and:

```ts
{
  component: 'Row',
  gap: 1,
  children: [
    { component: 'Text', children: ['Hello'] }
  ]
}
```

describe the same screen.

A screen can be written in TypeScript, loaded from JSON, generated, edited or sent over a wire without the runtime changing.

Everything else follows from that: one reactive store addressed by paths, typed registries for components, commands, themes, shells and resources, and a renderer that diffs cells rather than redrawing frames.

## Start with `@textui/kit`

One package is enough to have something on screen:

```bash
npm install @textui/kit
# pnpm add @textui/kit
```

[`@textui/kit`](https://www.npmjs.com/package/@textui/kit) is the runtime, a terminal to put it on, and `render`.

`Box`, `Text`, the hooks and `render` all come from here. The example above needs nothing else.

`render()` mounts the application and returns a handle immediately:

```tsx
const { app, waitUntilExit } = render(<App />);
await waitUntilExit();
```

| On the handle | What it does |
| --- | --- |
| `app` | Commands, themes, focus, the store — everything hello world did not need |
| `waitUntilExit()` | Resolves when the application stops, however it stopped |
| `unmount()` | Stops the app, puts the terminal back, resolves `waitUntilExit()` |
| `rerender(node)` | Swaps the root |

For one frame and no terminal — a report, `--help`, a test — use `renderOnce` or `renderToString` instead.

Those return. `render()` runs.

## Add the component catalog

For `Panel`, `Table`, `Row`, `Column`, charts, overlays, forms and the rest of the catalog, add [`@textui/widgets`](https://www.npmjs.com/package/@textui/widgets):

```bash
npm install @textui/widgets
# pnpm add @textui/widgets
```

Components imported directly can be used directly:

```tsx
import { Badge, Card } from '@textui/widgets';

function Status() {
  return (
    <Card title="Server">
      <Badge label="Online" tone="success" />
    </Card>
  );
}
```

Nothing to register.

When a screen names components in data, a string has to resolve to something. That is the case that needs the registry:

```tsx
import { render } from '@textui/kit';
import { registerBuiltins } from '@textui/widgets';

render(<Dashboard />, {
  onBoot: registerBuiltins,
});
```

Without it the name resolves to nothing, and the miss is drawn where the component should have been rather than thrown — so a forgotten registration looks like this instead of a stack trace:

```
<Card>
```

## Or start with the CLI

For a project set up for you, and for components copied into your source rather than imported:

```bash
npx @textui/cli init
# pnpm dlx @textui/cli init
```

And when something renders wrong:

```bash
npx @textui/cli doctor
```

`doctor` tells you what this terminal can actually do: Unicode level, colour depth, keyboard protocol and the capabilities TextUI detected.

## Packages

All six published packages use the same version and depend only on each other.

| Package | What it is | Source |
| --- | --- | --- |
| [`@textui/kit`](https://www.npmjs.com/package/@textui/kit) | One install: the runtime, a terminal and `render`. **Start here.** | [`packages/facade`](packages/facade) |
| [`@textui/core`](https://www.npmjs.com/package/@textui/core) | The runtime: store, registries, renderer, hooks and the four host primitives | [`packages/core`](packages/core) |
| [`@textui/widgets`](https://www.npmjs.com/package/@textui/widgets) | Component catalog: layout, display, controls, data, overlays and charts | [`packages/widgets`](packages/widgets) |
| [`@textui/terminal`](https://www.npmjs.com/package/@textui/terminal) | Terminal adapters, capability detection, ANSI writing and input decoding | [`packages/terminal`](packages/terminal) |
| [`@textui/testing`](https://www.npmjs.com/package/@textui/testing) | Headless harness: semantic queries, input, resizing and time | [`packages/testing`](packages/testing) |
| [`@textui/cli`](https://www.npmjs.com/package/@textui/cli) | `textui init / add / create / doctor`, and primitives for your own CLI | [`packages/cli`](packages/cli) |

### Also in the repository

Not published yet:

| Project | What it is |
| --- | --- |
| [`@textui/documents`](packages/documents) | Document buffers, resource viewers and content adapters |
| [`@textui/textide`](packages/textide) | An IDE that runs in a terminal, built on TextUI |
| [`@textui/textide-git`](packages/textide-git) | Git for TextIDE, as a loadable extension |
| [`components/`](components) | The source-copy registry — components you own, not import |
| [`playground/`](playground) | The showcase, focused playgrounds and a filesystem explorer |

## Zero dependencies

Nothing third-party is installed alongside it.

`@textui/core` has an empty `dependencies` field, and the packages above it depend only on each other — so what you audit is what you get, and the tree does not grow behind your back.

That also keeps the source close to running unbuilt. Node has erased types by default since 23.6, and most of this codebase is already erasable syntax.

The full argument, and what is still in the way, is in [`DEVELOPER.md`](DEVELOPER.md).

## Requirements

**Node >= 22**, or **Bun** — the packages are plain ESM with no native code, and run on either.

TypeScript is how the examples are written rather than something TextUI needs. For TSX:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@textui/kit"
  }
}
```

See [Getting started](docs/getting-started.md).

## Documentation

Published at **[softov.github.io/textui](https://softov.github.io/textui/)** and readable in [`docs/`](docs/README.md) as plain Markdown.

Start here:

| Document | What it answers |
| --- | --- |
| [Getting started](docs/getting-started.md) | From nothing to a running application |
| [The vocabulary](docs/vocabulary.md) | The words everything else assumes |
| [Architecture](docs/architecture.md) | The model: store, graph, registries, surfaces, shells |
| [Decisions and tradeoffs](docs/decisions.md) | What was chosen, and what it cost |

Then by subsystem:

| Section | What it covers |
| --- | --- |
| [Store](docs/store/README.md) | Paths, scopes, computed, collections, providers, events |
| [Components](docs/components/README.md) | The catalog, how to write one, and the templates |
| [Themes](docs/themes/README.md) | Tokens, glyphs, borders, capability downgrade, syntax |
| [Platform](docs/platform/README.md) | Commands, keybindings, focus, layers, screens, extension points |
| [Terminal](docs/terminal/README.md) | Adapters, capabilities, managed and embedded sessions |
| [Documents](docs/documents/README.md) | Resource kinds, providers, viewers, editors, buffers |
| [CLI](docs/cli/README.md) | The developer CLI and the registry model |
| [Testing](docs/testing.md) | The harness, and what to assert |

## Themes

### `dark`

<p align="center">
  <img src="./media/print-theme-dark.svg" alt="TextUI dark theme" />
</p>

### `light`

<p align="center">
  <img src="./media/print-theme-light.svg" alt="TextUI light theme" />
</p>

### `console`

<p align="center">
  <img src="./media/print-theme-console.svg" alt="TextUI console theme" />
</p>

### `paper-dark`

<p align="center">
  <img src="./media/print-theme-paper-dark.svg" alt="TextUI paper-dark theme" />
</p>

### `paper-light`

<p align="center">
  <img src="./media/print-theme-paper-light.svg" alt="TextUI paper-light theme" />
</p>

### `workbench`

<p align="center">
  <img src="./media/print-theme-workbench.svg" alt="TextUI workbench theme" />
</p>

### `mono`

<p align="center">
  <img src="./media/print-theme-mono.svg" alt="TextUI mono theme" />
</p>

## Developing

Working on TextUI rather than with it — building, testing, the playgrounds, the docs site and how a release is cut — is in [`DEVELOPER.md`](DEVELOPER.md).

## License

MIT
