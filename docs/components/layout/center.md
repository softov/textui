---
title: Center
parent: Layout and overflow
grand_parent: Components
---

# Center
{: .no_toc }

Centres its children on one axis or both.

```tsx
import { Center } from '@textui/core';

<Center flex={1}>
  <text content="nothing selected" fg="muted" />
</Center>
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `axis` | `'both' \| 'horizontal' \| 'vertical'` |  | Centre horizontally, vertically, or both. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

`axis` takes `'both'` (the default), `'horizontal'` or `'vertical'`.

Centring needs room to centre in, so this is nearly always paired with
`flex={1}` or a fixed size. A `Center` that is exactly as big as its child
does nothing at all.

## See also

- [EmptyState](../display/empty-state.md) - the centred "nothing here" message, already written
- [Row](row.md), [Column](column.md) - `align` and `justify` for finer placement
