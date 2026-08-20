# TextUI

A dependency-free TypeScript terminal UI runtime. Screens are plain data; JSX is one way to write them.

```tsx
import { createApp, registerBuiltins } from '@textui/core';
import { createNodeTerminal } from '@textui/terminal';

const app = createApp({
  terminal: createNodeTerminal(),
  root: <Dashboard />,
  onBoot: registerBuiltins,
});

await app.start();
```

> Status: pre-1.0. The surface is still moving.

## The one idea

**JSX compiles to data.** `<Row gap={1}/>` and `{ component: 'Row', gap: 1 }` are the same value, and the runtime mounts either. A screen can be written in TypeScript, loaded from JSON, generated, edited or sent over a wire without the runtime changing - and components are resolved by name at mount time, so what renders is a registration rather than an import.

Everything else follows from that: one reactive store addressed by paths, typed registries for components, commands, themes, shells and resources, and a renderer that diffs cells rather than redrawing frames.

## Packages

| Package | What it is |
| --- | --- |
| [`@textui/core`](packages/core) | The runtime: store, registries, renderer, hooks, component catalog |
| [`@textui/terminal`](packages/terminal) | Terminal adapters, capability detection, ANSI writing, input decoding |
| [`@textui/testing`](packages/testing) | Headless harness: semantic queries, input, resizing, time |
| [`@textui/cli`](packages/cli) | `textui init / add / create / doctor`, and primitives for your own CLI |
| [`components/`](components) | The source-copy registry - components you own, not import |
| [`playground/`](playground) | The showcase, fourteen focused playgrounds, and a filesystem explorer |

## Documentation

| Document | What it answers |
| --- | --- |
| [`docs/README.md`](docs/README.md) | The vocabulary everything else assumes |
| [`docs/architecture.md`](docs/architecture.md) | The model: store, graph, registries, surfaces, shells |
| [`docs/getting-started.md`](docs/getting-started.md) | From nothing to a running application |
| [`docs/components.md`](docs/components.md) | The catalog, and how to write one |
| [`docs/theming.md`](docs/theming.md) | Tokens, glyphs, borders, density, capability downgrade |
| [`docs/store.md`](docs/store.md) | Paths, scopes, computed, collections, providers, events |
| [`docs/commands-focus.md`](docs/commands-focus.md) | Commands, keybindings, focus scopes, layers |
| [`docs/resources.md`](docs/resources.md) | Kinds, providers, viewers, editors, actions, adapters, documents |
| [`docs/syntax.md`](docs/syntax.md) | Highlighters, scopes, and how a theme colours them |
| [`docs/adapters.md`](docs/adapters.md) | Terminals, capabilities, managed and embedded sessions |
| [`docs/testing.md`](docs/testing.md) | The harness, and what to assert |
| [`docs/cli.md`](docs/cli.md) | The developer CLI and the registry model |
| [`docs/templates.md`](docs/templates.md) | The shipped templates |
| [`docs/extending.md`](docs/extending.md) | Registries, manifests, extension points |
| [`docs/decisions.md`](docs/decisions.md) | What was chosen, and what it cost |

## Development

```bash
pnpm install
pnpm build          # every package
pnpm typecheck      # every workspace
pnpm test           # every suite
pnpm dev --list     # the playgrounds
pnpm dev gallery    # open one
```

Node ≥ 22, pnpm 10.

## The acceptance test

The three layouts this project started from - a dense bordered console, an airy borderless report, and a workbench frame - are one architecture with three registrations. `playground/test/playgrounds.test.tsx` mounts the same component under all of them, and under six themes, at three terminal widths, with and without Unicode and colour. If a shell ever needs a component the others cannot use, the boundary is in the wrong place.

## License

MIT
