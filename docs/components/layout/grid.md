---
title: Grid
parent: Layout and overflow
grand_parent: Components
---

# Grid
{: .no_toc }

Equal-width columns that wrap into rows.

```tsx
import { Grid } from '@textui/widgets';

<Grid columns={3} gap={1}>
  <text content="one" />
  <text content="two" />
  <text content="three" />
  <text content="four" />
</Grid>
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `columns` | `number` | **required** |  |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

`columns` is required and fixed: this is not a responsive grid, and it will not drop to fewer columns on a narrow terminal by itself. Change `columns` from a [breakpoint](../base-props.md) or from measured width when that matters.

Every column is the same width. For columns that are not, use a [Row](row.md) and give each child its own `flex` or `width`.

## See also

- [Row](row.md) - unequal columns
- [Table](../display/table.md) - columns with headers, priorities and rows
