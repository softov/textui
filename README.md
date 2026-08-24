# TextUI

A dependency-free TypeScript terminal UI runtime. Screens are plain data; JSX is one way to write them.

```bash
npm install textui @textui/widgets
```

```tsx
import { render } from 'textui';
import { registerBuiltins } from '@textui/widgets';

const { waitUntilExit } = render(<Dashboard />, { onBoot: registerBuiltins });
await waitUntilExit();
```

> Status: pre-1.0. The surface is still moving.

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

| Package | What it is |
| --- | --- |
| [`textui`](packages/facade) | One install: the runtime, a terminal, and `render`. Start here |
| [`@textui/core`](packages/core) | The runtime: store, registries, renderer, hooks, the four host primitives |
| [`@textui/widgets`](packages/widgets) | The component catalog: layout, display, controls, data, overlays, charts |
| [`@textui/terminal`](packages/terminal) | Terminal adapters, capability detection, ANSI writing, input decoding |
| [`@textui/testing`](packages/testing) | Headless harness: semantic queries, input, resizing, time |
| [`@textui/cli`](packages/cli) | `textui init / add / create / doctor`, and primitives for your own CLI |

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
