# TextUI

[![npm](https://img.shields.io/npm/v/@textui/kit?label=%40textui%2Fkit)](https://www.npmjs.com/package/@textui/kit)
[![node](https://img.shields.io/node/v/@textui/kit)](https://nodejs.org)
[![dependencies](https://img.shields.io/badge/dependencies-none-brightgreen)](#no-dependencies)
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

> Status: pre-1.0. The surface is still moving.

## Installing

One package is enough to have something on screen. The rest are additive, and
nothing pulls in a third-party dependency.

```bash
npm install @textui/kit          # pnpm add @textui/kit
```

`@textui/kit` is the runtime, a terminal to put it on, and `render`. `Box`,
`Text`, the hooks and `render` all come from here, and the example above needs
nothing else.

**For the component catalog** - `Panel`, `Table`, `Row`, `Column`, charts,
overlays, forms - add `@textui/widgets`. Its components are resolved by name at
mount time, so they have to be registered before they can render:

```bash
npm install @textui/kit @textui/widgets    # pnpm add @textui/kit @textui/widgets
```

```tsx
import { render } from '@textui/kit';
import { registerBuiltins } from '@textui/widgets';

const { waitUntilExit } = render(<Dashboard />, { onBoot: registerBuiltins });
await waitUntilExit();
```

Forget `onBoot` and the components are missing registrations rather than
missing imports - the screen renders, and says so where they should have been.

**For a project set up for you**, and for components copied into your source
rather than imported, use the CLI. It needs no install:

```bash
npx @textui/cli init             # pnpm dlx @textui/cli init
npx @textui/cli doctor           # what this terminal can actually do
```

`doctor` is the one to run first when something renders wrong - it reports the
unicode level, colour depth and keyboard protocol actually detected.

**Working against the pieces directly** - `@textui/core` and `@textui/terminal`
- is the same thing with a longer name. `@textui/kit` re-exports both and adds
`render`; there is nothing in them it hides. Take them separately when you want
the runtime without a terminal attached, which is what the test harness and the
static renderer do:

```bash
npm install @textui/core @textui/terminal  # pnpm add @textui/core @textui/terminal
```

Node >= 22, and TypeScript wants `"jsx": "react-jsx"` with
`"jsxImportSource": "@textui/kit"` - see [getting started](docs/getting-started.md).

## The one idea

**JSX compiles to data.** `<Row gap={1}/>` and `{ component: 'Row', gap: 1 }` are the same value, and the runtime mounts either. A screen can be written in TypeScript, loaded from JSON, generated, edited or sent over a wire without the runtime changing - and components are resolved by name at mount time, so what renders is a registration rather than an import.

Everything else follows from that: one reactive store addressed by paths, typed registries for components, commands, themes, shells and resources, and a renderer that diffs cells rather than redrawing frames.

## No dependencies

Nothing is installed alongside it. `@textui/core` has an empty `dependencies`,
and the packages above it depend only on each other - so what you audit is what
you get, and the tree does not grow behind your back.

That also keeps the source close to running unbuilt: Node has erased types by
default since 23.6, and most of this codebase is already erasable syntax. The
full argument, and what is still in the way, is in
[`DEVELOPER.md`](DEVELOPER.md).

## Packages

| Package | What it is | |
| --- | --- | --- |
| [`@textui/kit`](https://www.npmjs.com/package/@textui/kit) | One install: the runtime, a terminal, and `render`. Start here | [source](packages/facade) |
| [`@textui/core`](https://www.npmjs.com/package/@textui/core) | The runtime: store, registries, renderer, hooks, the four host primitives | [source](packages/core) |
| [`@textui/widgets`](https://www.npmjs.com/package/@textui/widgets) | The component catalog: layout, display, controls, data, overlays, charts | [source](packages/widgets) |
| [`@textui/terminal`](https://www.npmjs.com/package/@textui/terminal) | Terminal adapters, capability detection, ANSI writing, input decoding | [source](packages/terminal) |
| [`@textui/testing`](https://www.npmjs.com/package/@textui/testing) | Headless harness: semantic queries, input, resizing, time | [source](packages/testing) |
| [`@textui/cli`](https://www.npmjs.com/package/@textui/cli) | `textui init / add / create / doctor`, and primitives for your own CLI | [source](packages/cli) |

All six are published at the same version and depend only on each other.

Also in the repository, not yet published:

| Package | What it is |
| --- | --- |
| [`@textui/documents`](packages/documents) | Document buffers, resource viewers and content adapters |
| [`@textui/textide`](packages/textide) | An IDE that runs in a terminal, built on TextUI |
| [`@textui/textide-git`](packages/textide-git) | Git for textide, as a loadable extension |
| [`components/`](components) | The source-copy registry - components you own, not import |
| [`playground/`](playground) | The showcase, fourteen focused playgrounds, and a filesystem explorer |

## Documentation

Published at **<https://softov.github.io/textui/>**, and readable in [`docs/`](docs/README.md) as plain markdown.

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

## A quick taste

> *Let's cut to the chase, shall we?*

Here's what TextUI actually looks like and what it can do.


### theme `dark`
<p align="center">
  <img src="./media/print-theme-dark.svg" alt="Terminal UI Dark" />
</p>

### theme `light`
<p align="center">
  <img src="./media/print-theme-light.svg" alt="Terminal UI Light" />
</p>

### theme `console`
<p align="center">
  <img src="./media/print-theme-console.svg" alt="Terminal UI Console" />
</p>

### theme `paper-dark`
<p align="center">
  <img src="./media/print-theme-paper-dark.svg" alt="Terminal UI showcase paper-dark" />
</p>

### theme `paper-light`
<p align="center">
  <img src="./media/print-theme-paper-light.svg" alt="Terminal UI showcase paper-light" />
</p>

### theme `workbench`
<p align="center">
  <img src="./media/print-theme-workbench.svg" alt="Terminal UI Workbench" />
</p>

### theme `mono`
<p align="center">
  <img src="./media/print-theme-mono.svg" alt="Terminal UI Mono" />
</p>

## Developing

Working on TextUI rather than with it - building, testing, the playgrounds, the
docs site and how a release is cut - is in [`DEVELOPER.md`](DEVELOPER.md).

## License

MIT
