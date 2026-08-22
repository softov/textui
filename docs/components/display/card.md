---
title: Card
parent: Display and data
grand_parent: Components
---

# Card
{: .no_toc }

A titled block with no frame, for grouping without drawing a box.

```tsx
import { Card } from '@textui/core';

<Card title="billing-worker" subtitle="eu-west-1" footer="updated 2m ago">
  <text content="42 jobs queued" />
</Card>
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `title` | `string` |  |  |
| `subtitle` | `string` |  |  |
| `footer` | `string` |  |  |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Where [`Panel`](../layout/panel.md) draws a region, a card groups by spacing
and weight alone. Use a panel when the boundary matters - a pane you can focus,
resize or scroll - and a card when several of them sit in a
[`Grid`](../layout/grid.md) and a border each would be a cage.

## See also

- [Panel](../layout/panel.md) - the framed version
- [KeyValue](key-value.md) - for a card that is mostly field-and-value
