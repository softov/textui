# @textui/widgets

The component catalog: eighty-seven components built out of the four primitives
in [`@textui/core`](https://www.npmjs.com/package/@textui/core).

```bash
npm install @textui/widgets
```

```tsx
import { Card, Row, Badge } from '@textui/widgets';

<Card title="Services">
  <Row gap={2}>
    <text content="api" />
    <Badge label="up" tone="success" />
  </Row>
</Card>
```

## Importing is registering

There is nothing to call first. `<Card/>` compiles to a node that carries the
imported function, and the runtime uses that in preference to any registry - so
a screen written in JSX renders with the registry empty.

`registerBuiltins(app)` exists for the other case: a screen named in data, where
a string has to resolve to something.

```ts
import { createApp } from '@textui/core';
import { registerBuiltins } from '@textui/widgets';

const app = createApp({ terminal, root, onBoot: registerBuiltins });
```

It registers the catalog, the surface layouts and the built-in shells in one
call, and returns one `Disposable` that takes all of it back out. For a static
render, `renderOnce(node, { components: CATALOG })` is the same idea.

## What is here

| Group | Count | |
|---|---|---|
| `layout` | 10 | Row, Column, Grid, Panel, Splitter, ScrollView |
| `display` | 14 | Heading, Badge, Card, Alert, Progress, Spinner, Timeline |
| `control` | 9 | Button, TextInput, TextArea, Select, Checkbox, RadioGroup, Slider, Switch |
| `data` | 8 | Table, Tree, List, CodeViewer, MarkdownView, Feed |
| `overlay` | 8 | Dialog, CommandPalette, PathPicker, Toast, Tooltip |
| `navigation` | 7 | Tabs, Menu, Breadcrumb, Wizard |
| `surface` | 9 | Mounts and layouts - how a screen is divided |
| `chart` | 7 | Sparkline, BarChart, LineChart, Histogram, Heatmap, Gauge |
| `form` | 5 | Form, Field, validation |
| `shells` | 4 | The frame around an application |
| `panel` | 1 | A pane that opens a resource with whatever viewer is registered |

One file per component, in a folder per group - `src/display/badge.ts`. `ls
src/display/` is the inventory.

## Runtime

No dependencies beyond [`@textui/core`](https://www.npmjs.com/package/@textui/core), and no `node:` imports. Node 22+ and Bun.

## Documentation

<https://softov.github.io/textui/>

Every component has its own page, with the prop table generated from the source
and a working example - see [`docs/components/`](https://softov.github.io/textui/components/).

<!-- family -->

---

Part of **[TextUI](https://github.com/softov/textui)** - [documentation](https://softov.github.io/textui/) - [getting started](https://softov.github.io/textui/getting-started.html)

[`@textui/kit`](https://www.npmjs.com/package/@textui/kit) one install · [`@textui/core`](https://www.npmjs.com/package/@textui/core) the runtime · **`@textui/widgets`** the catalog · [`@textui/terminal`](https://www.npmjs.com/package/@textui/terminal) adapters and input · [`@textui/testing`](https://www.npmjs.com/package/@textui/testing) the harness · [`@textui/cli`](https://www.npmjs.com/package/@textui/cli) the CLI
