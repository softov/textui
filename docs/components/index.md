---
title: Components
nav_order: 6
has_children: true
---

# Components

Everything here is importable from `@textui/core`. Calling `registerBuiltins(app)`
puts the whole catalog into the component registry, which is what lets a node
graph name `'Table'` and get one.

## The four primitives

The layout engine and the painter only ever see these, which is why adding a
component costs a function rather than a case in the engine.

| Primitive | What it is |
| --- | --- |
| `box` | The container. Flex layout, background, border, title, footer, scroll |
| `text` | A run of text. Wraps, truncates, aligns |
| `canvas` | Direct cell painting. The escape hatch charts use |
| `spacer` | Empty space, greedy when given `flex` |

Every node also accepts `role`, `label`, `focusable`, `onKey`, `onClick`,
`disabled` and `selected` - so a bare `box` can take focus and handle keys
without a hook.
