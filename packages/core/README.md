# @textui/core

The runtime: a reactive store, typed registries, a cell-diffing renderer, hooks,
and the four host primitives. Everything else in TextUI sits on this.

```bash
npm install @textui/core
```

## The one idea

**JSX compiles to data.** `<Row gap={1}/>` and `{ component: 'Row', gap: 1 }` are
the same value, and the runtime mounts either. A screen can be written in
TypeScript, loaded from JSON, generated, edited or sent over a wire without the
runtime changing.

```ts
import { h, renderToString } from '@textui/core';

console.log(renderToString(
  h('box', { margin: 1, border: 'single' }, h('text', { content: 'hello' })),
  { width: 30 },
));
```

Capitalized spellings of the primitives exist for JSX - `Box`, `Text`, `Canvas`
are the strings themselves, so `<Box/>` and `<box/>` produce the identical node.

## What is in here, and what is not

The four primitives - `box`, `text`, `canvas`, `spacer` - are here because the
layout engine and the painter are the things that reason about them. The
eighty-seven components built out of them are [`@textui/widgets`](https://github.com/softov/textui/tree/main/packages/widgets),
a separate package that depends on this one.

That split is not tidiness. An imported component travels on its own node, so a
screen written in JSX resolves without a registry at all:

```ts
import { Badge } from '@textui/widgets';

renderToString(h(Badge, { label: 'ok' }), { width: 20 });  // registry empty
```

The registry is for the case JSX cannot cover - a component named by a string,
in JSON, a template renderer, or an extension. `render` takes those through its
`components` option.

## The parts

| | |
|---|---|
| Store | One reactive tree addressed by path. A prop can be `{ path: '$/x' }` and the runtime resolves it and redraws when it changes |
| Registries | Components, commands, keybindings, themes, shells, surfaces, resources - typed, and disposable |
| Renderer | Diffs cells rather than redrawing frames. `renderOnce` and `renderToString` draw one frame with no terminal at all |
| Hooks | `useState`, `useEffect`, `useStore`, `useFocus`, `useInterval` and thirty more - module imports, not a second argument |
| Layers | Dialogs, palettes, toasts and tooltips are entries on five planes, so focus trapping and dismissal are decided once |

## Runtime

No dependencies, and no `node:` imports - this package never touches a
filesystem or a process. It runs on Node 22+ and on Bun, and would run in a
browser against a virtual terminal.

## Documentation

<https://softov.github.io/textui/>
