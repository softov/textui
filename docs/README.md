---
title: Home
nav_order: 1
permalink: /
---

<!-- docs:setup
import type { RenderOutput } from '@textui/core';
declare function Dashboard(): RenderOutput;
-->

# TextUI

A dependency-free TypeScript terminal UI runtime. Screens are plain data; JSX is
one way to write them.

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

{: .warning }
> Pre-1.0. The surface is still moving.

## The one idea

**JSX compiles to data.** `<Row gap={1}/>` and `{ component: 'Row', gap: 1 }` are
the same value, and the runtime mounts either. A screen can be written in
TypeScript, loaded from JSON, generated, edited or sent over a wire without the
runtime changing - and components are resolved by name at mount time, so what
renders is a registration rather than an import.

Everything else follows from that: one reactive store addressed by paths, typed
registries for components, commands, themes, shells and resources, and a renderer
that diffs cells rather than redrawing frames.

## Where to start

| If you want | Read |
| --- | --- |
| Something running | [Getting started](getting-started.md) |
| The words the rest of this assumes | [The vocabulary](vocabulary.md) |
| The model, end to end | [Architecture](architecture.md) |
| What was chosen, and what it cost | [Decisions and tradeoffs](decisions.md) |

## The subsystems

| Section | What it covers |
| --- | --- |
| [Store](store/) | Paths, scopes, computed, collections, providers, events |
| [Components](components/) | The catalog, and how to write one |
| [Themes](themes/) | Tokens, glyphs, borders, capability downgrade, syntax |
| [Platform](platform/) | Commands, keybindings, focus, layers, screens, extension points |
| [Terminal](terminal/) | Adapters, capabilities, managed and embedded sessions |
| [Documents](documents/) | Resource kinds, providers, viewers, editors, buffers |
| [CLI](cli/) | The developer CLI and the registry model |
| [Testing](testing.md) | The harness, and what to assert |

## Packages

| Package | What it is |
| --- | --- |
| `@textui/core` | The runtime: store, registries, renderer, hooks, component catalog |
| `@textui/terminal` | Terminal adapters, capability detection, ANSI writing, input decoding |
| `@textui/testing` | Headless harness: semantic queries, input, resizing, time |
| `@textui/cli` | `textui init / add / create / doctor`, and primitives for your own CLI |
| `components/` | The source-copy registry - components you own, not import |
| `playground/` | The showcase, fourteen focused playgrounds, and a filesystem explorer |

## Development

```bash
pnpm install
pnpm build          # every package
pnpm typecheck      # every workspace
pnpm test           # every suite
pnpm dev --list     # the playgrounds
pnpm dev gallery    # open one
```

Node ≥ 22, pnpm 10. The source is on
[GitHub](https://github.com/softov/textui).
