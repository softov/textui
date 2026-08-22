---
title: Nodes
parent: Components
nav_order: 3
---

<!-- docs:setup
declare const app: import('@textui/core').TextUIApp;
declare const save: () => void;
-->

# Nodes
{: .no_toc }

A node is a plain object with a `component` name and props. JSX produces
exactly this, so the two lines below are the same value:

```tsx
import type { ComponentNode } from '@textui/core';
import { Row } from '@textui/core';

const fromJsx = <Row gap={1} />;
const fromData: ComponentNode = { component: 'Row', gap: 1 };
```

Nothing in a node is a module reference - `'Row'` is a name the registry
resolves at mount time, not an import. That is what lets a screen be persisted,
generated or sent, and it is why the component pages document both forms.

## Reserved keys

Four keys are structural. Everything else on the object is props, and props are
the component's business.

| Key | Means |
| --- | --- |
| `component` | The registered name to mount. The only required key. |
| `id` | A stable identity for this node. |
| `key` | Reconciliation identity among siblings. |
| `$meta` | Internal - origin, error fallback, source location. Not yours to set. |

## Children

Inline, as an array:

```ts
import type { ComponentNode } from '@textui/core';

const row: ComponentNode = {
  component: 'Row',
  gap: 1,
  children: [
    { component: 'text', content: 'left' },
    { component: 'spacer', flex: 1 },
    { component: 'text', content: 'right' },
  ],
};
```

Or as one instance of a template per item at a store path, which is how a list
of unknown length is expressed without a loop:

```ts
import type { ComponentNode } from '@textui/core';

const list: ComponentNode = {
  component: 'Column',
  children: {
    template: { component: 'text', content: { path: '/name' } },
    path: '$/services/list',
  },
};
```

Inside a template, a relative path like `/name` is read against the current
item - each expansion is given a data context of `$/services/list/0`, `/1` and
so on. `$/` escapes back to the root of the store.

Reconciliation keys come from the item, not the template: an item with an `id`
is keyed by it, and one without is keyed by its index. Giving rows a stable
`id` is what stops a reorder from being read as an edit to every row.

## Props that are not values

A prop can hold data describing where its value comes from, or what should
happen, instead of the value itself. Three shapes, distinguished by their keys.

### A binding reads the store

```ts
import type { ComponentNode } from '@textui/core';

const title: ComponentNode = {
  component: 'Heading',
  content: { path: '$/session/title' },
};
```

The runtime reads the path, subscribes to exactly it, and re-renders this node
when it changes. Nothing else re-renders, and the component needs no support
for any of it. See [Paths and scopes](../store/paths.md).

### A function call returns a value

```ts
import type { ComponentNode } from '@textui/core';

const count: ComponentNode = {
  component: 'Badge',
  label: { call: 'services.count' },
};
```

### An action describes what to run

Three forms, on any prop named `on` followed by a capital - `onPress`,
`onSelect`, `onChange`, and so on. `once` and `only` are not handler props;
the capital is what the runtime tests for.

```ts
import type { ComponentNode } from '@textui/core';

const buttons: ComponentNode[] = [
  { component: 'Button', label: 'Local',   onPress: { handler: () => save() } },
  { component: 'Button', label: 'Command', onPress: { functionCall: { call: 'file.save' } } },
  { component: 'Button', label: 'Event',   onPress: { emit: { path: '@/dialog/cancel' } } },
];
```

| Form | Runs | Stays data |
| --- | --- | --- |
| `{ handler }` | The closure | No |
| `{ functionCall }` | A registered command | Yes |
| `{ emit }` | Publishes on an event path | Yes |

A bare function works too - `onPress: save` - because the resolver passes
functions through untouched. The library wraps closures in `{ handler }` when
it builds nodes as objects, to keep the three forms symmetric.

The runtime turns whichever you wrote into a callable *before the component
sees it*, so a component receives a function in every case and never inspects
which form was used. This is keyed on the prop's name, not on a list of known
props, so it works on components you write without you doing anything.

## What survives being turned into JSON

`{ functionCall }` and `{ emit }` name what to run rather than holding it, so
they are ordinary JSON. A closure is not, and `JSON.stringify` drops it - which
is the whole of the difference between the two, and the reason to prefer a
[command](../platform/commands.md) for anything a user can also reach from a
keybinding or the palette.

## See also

- [The vocabulary](../vocabulary.md) - node, graph, registry, binding, in one page
- [Base props](base-props.md) - what every node accepts
- [Writing a component](writing.md) - resolving props inside one
