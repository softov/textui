---
title: Getting started
nav_order: 2
---

# Getting started

```bash
pnpm add @textui/core @textui/terminal
```

Node ≥ 22. There are no other dependencies.

## The smallest thing that runs

```tsx
import { createApp, registerBuiltins, WRITER_KEY } from '@textui/core';
import { createNodeTerminal, createWriter } from '@textui/terminal';

const terminal = createNodeTerminal();

const app = createApp({
  terminal,
  root: { component: 'text', content: 'hello' },
  onBoot: registerBuiltins,
});

app.services.provide(WRITER_KEY, createWriter(terminal.capabilities()));
await app.start();
```

`registerBuiltins` puts the component catalog, the surface layouts and the built-in shells into the registries. The writer is a service rather than an import so the core never depends on terminal encoding - which is what lets the test harness and the static renderer run the same application with no writer at all.

## JSX

Point the compiler at the runtime:

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@textui/core"
  }
}
```

Then `<Row gap={1}/>` produces `{ component: 'Row', gap: 1 }`. Lowercase names are host primitives - `box`, `text`, `canvas`, `spacer` - and capitalised names are components you import, which is what gives them prop types.

```tsx
import { Column, Panel, Row, Table, useStoreValue } from '@textui/core';

function Services() {
  const services = useStoreValue<Service[]>('$/services/list', []) ?? [];

  return (
    <Column flex={1} gap={1} padding={1}>
      <Panel title="Services" meta={`${services.length}`}>
        <Table
          columns={[
            { key: 'name', header: 'NAME', width: 18 },
            { key: 'status', header: 'STATUS', width: 10, priority: 90 },
            { key: 'cpu', header: 'CPU', width: 7, align: 'right', priority: 40 },
          ]}
          rows={services}
        />
      </Panel>
    </Column>
  );
}
```

## Adding a shell

A `root` node fills the terminal. To get chrome - a header, a sidebar, tabs, a status bar - mount into surfaces and let a shell arrange them:

```tsx
const app = createApp({
  terminal,
  shell: 'workbench',
  onBoot: (app) => {
    registerBuiltins(app);

    app.open({ surface: 'header', key: 'title', target: { component: 'text', content: 'TextUI' } });
    app.open({ surface: 'sidebar', key: 'nav', target: <Navigation /> });
    app.open({ surface: 'main', key: 'services', target: <Services />, display: { title: 'Services' } });
    app.open({ surface: 'status', key: 'hints', target: <KeyHints hints={[{ keys: 'q', label: 'quit' }]} /> });
  },
});
```

Switch `shell` to `'console'` or `'paper'` and the same mounts render as a dense bordered console or an airy report. Nothing above changes.

## Commands, not handlers

```tsx
onBoot: (app) => {
  registerBuiltins(app);

  app.commands.register({
    id: 'app.quit',
    title: 'Quit',
    slots: ['palette', 'hints'],
    run: () => void app.stop().then(() => process.exit(0)),
  });

  app.keybindings.register({ keys: 'q', commandId: 'app.quit' });
  app.keybindings.register({ keys: 'ctrl+c', commandId: 'app.quit' });
}
```

The command is now reachable from the chord, from the palette, and from `app.execute('app.quit')` - one implementation, three ways in.

## Rendering without a terminal

The same component model renders to a string, which is what makes it useful for reports, `--help` output and tests:

```ts
import { renderToString } from '@textui/core';

console.log(renderToString(<Services />, {
  width: 80,
  initialState: { '$/services/list': services },
}));
```

## Where to go next

- [`store.md`](store.md) - paths, scopes, providers
- [`components.md`](components.md) - the catalog
- [`theming.md`](theming.md) - tokens and capability downgrade
- [`testing.md`](testing.md) - the harness
