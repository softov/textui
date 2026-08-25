---
title: Sparkline
parent: Display and data
grand_parent: Components
---

# Sparkline
{: .no_toc }

A trend in one row, drawn with eight block levels.

```tsx
import { Sparkline } from '@textui/widgets';

<Sparkline values={[3, 5, 4, 8, 6, 9]} showValue />
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `values` | `number[]` | **required** |  |
| `min` | `number` |  |  |
| `max` | `number` |  |  |
| `tone` | `'default' \| 'primary' \| 'secondary' \| 'accent' \| 'success' \| 'warning' \| 'danger' \| 'info' \| 'muted'` | `'accent'` |  |
| `chartWidth` | `number` |  | Cells wide. Values are sampled to fit. |
| `showValue` | `boolean` | `false` | Print the latest value after the line. |
| `format` | `(value: number) => string` |  |  |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

One row, so it fits in a table cell or beside a label. A cell has one level of resolution, so the shape is drawn from the eight block glyphs rather than pretending at pixels.

`showValue` prints the last value after the line, and is worth turning on: a shape with no scale is decoration.

## See also

- [LineChart](line-chart.md) - when the shape needs an axis
- [Progress](progress.md) - one value rather than a series
