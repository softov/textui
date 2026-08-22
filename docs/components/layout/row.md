---
title: Row
parent: Layout and overflow
grand_parent: Components
---

# Row
{: .no_toc }

A horizontal flex container.

```tsx
import { Row } from '@textui/core';

<Row gap={1} padding={1}>
  <text content="name" />
  <text content="status" />
</Row>
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `vAlign` | `BoxProps['align']` |  | Shorthand for `align`, which reads better on a row. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

`Row` is `<box direction="row">` with one difference worth knowing: it
centres its children on the cross axis by default, so a one-line label sits
level with a three-line panel beside it rather than at its top. `vAlign`
overrides that - `'start'`, `'center'`, `'end'` or `'stretch'`.

Sideways is the axis that shrinks. When a row does not fit, a child with
`flex` gives way first and a rigid one truncates its text; nothing is placed
outside the container.

## See also

- [Column](column.md) - the same thing, vertically
- [Grid](grid.md) - equal columns that wrap
- [Splitter](splitter.md) - two panes with a movable divide
