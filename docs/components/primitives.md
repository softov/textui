---
title: The four primitives
parent: Components
nav_order: 3
has_children: true
---

# The four primitives

```tsx
<box direction="column" gap={1} padding={1} border="single" title="Services">
  <text content="api-gateway" bold />
  <spacer flex={1} />
  <text content="12 running" fg="muted" />
</box>
```

Four, and the layout engine and the painter see nothing else. Every component in the catalog is a function that returns some arrangement of these, which is why adding one costs a function rather than a case in the engine - and why a component you write is the same kind of thing as a component that ships.

| | |
| --- | --- |
| [`box`](primitives/box.md) | The container. Flex layout, background, border, title, footer, scroll |
| [`text`](primitives/text.md) | A run of text. Wraps, truncates, aligns |
| [`canvas`](primitives/canvas.md) | Direct cell painting. The escape hatch the charts use |
| [`spacer`](primitives/spacer.md) | Empty space, greedy when given `flex` |

## Lowercase, and no import

They are host intrinsics rather than components, declared in the JSX namespace, so nothing imports them and nothing registers them. That is the rule the case tells you: a lowercase name is one of these four and is always available; a capitalised one is a component you imported, which is what gives it prop types.

As a node they are the `component` field like anything else - `{ component: 'text', content: 'hello' }` - so a graph that arrives over a wire can name them too. [Nodes](nodes.md) has the rest of that.

## What they share

All four take [base props](base-props.md): `role`, `label`, `focusable`, `onKey`, `onClick`, `disabled` and `selected`, plus the box model. So a bare `box` can take focus and handle keys without a hook and without being wrapped in anything.

```tsx
<box focusable role="button" label="Retry" onKey={(key) => key.name === 'enter'}>
  <text content="Retry" />
</box>
```

That is the whole reason `Button` is thirty lines rather than a special case: it is a `box` that knows what a button looks like in the current theme.

## When to reach for `canvas`

When the thing you are drawing is not text in a box - a plot, a sparkline, a tile pattern. `canvas` hands you the cells and gets out of the way, and every chart in the catalog is built on it. Everything else reads better as boxes and text, which wrap, align and reflow on their own.
