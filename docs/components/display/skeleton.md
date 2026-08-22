---
title: Skeleton
parent: Display and data
grand_parent: Components
---

# Skeleton
{: .no_toc }

The shape of content that has not arrived yet.

```tsx
import { Skeleton } from '@textui/core';

<Skeleton lines={3} widths={[100, 80, 60]} />
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `lines` | `number` |  |  |
| `widths` | `number[]` |  | Width of each line, in cells or as a fraction of the box. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

`widths` are percentages, and varying them is the whole trick: three identical
bars read as a bar chart, while three ragged ones read as a paragraph.

Worth it when the layout is known and the data is not, so that arriving content
does not shift the screen. Not worth it for anything that usually resolves in
one frame.

## See also

- [Spinner](spinner.md) - when the shape is not known either
- [EmptyState](empty-state.md) - when nothing is coming
