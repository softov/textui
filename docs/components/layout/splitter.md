---
title: Splitter
parent: Layout and overflow
grand_parent: Components
---

# Splitter
{: .no_toc }

Two panes with a divider between them.

```tsx
import { Splitter } from '@textui/widgets';

<Splitter direction="row" size="30%">
  <text content="sidebar" />
  <text content="main" />
</Splitter>
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `direction` | `'row' \| 'column'` | `'row'` |  |
| `size` | `number \| `${number}%` \| 'auto'` | `'50%'` | Size of the first pane, in cells or percent. |
| `dividerSize` | `number` | `1` | Cells the divider occupies. 0 hides it. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Exactly two children. `size` applies to the first one and takes a number of cells or a percentage; the second takes what is left. `dividerSize` is the gap between them in cells.

`direction` is `'row'` for a vertical divide and `'column'` for a horizontal one - it names the axis the children are laid along, matching [`Row`](row.md) and [`Column`](column.md) rather than the direction the rule is drawn.

## See also

- [SplitLayout](../surfaces/split-layout.md) - the same idea for surface mounts
- [Row](row.md) - more than two children, no divider
