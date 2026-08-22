---
title: Histogram
parent: Display and data
grand_parent: Components
---

# Histogram
{: .no_toc }

A distribution, bucketed from raw values.

```tsx
import { Histogram } from '@textui/core';

<Histogram values={[2, 3, 3, 4, 7, 8, 8, 9]} buckets={8} />
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `values` | `number[]` | **required** |  |
| `buckets` | `number` | `12` | Number of buckets. |
| `min` | `number` |  |  |
| `max` | `number` |  |  |
| `tone` | `'default' \| 'primary' \| 'secondary' \| 'accent' \| 'success' \| 'warning' \| 'danger' \| 'info' \| 'muted'` | `'accent'` |  |
| `chartHeight` | `number` | `6` |  |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Give it the raw values, not counts - the bucketing is the component's job, and
doing it outside means two places decide what a bucket is.

`buckets` defaults to twelve. Fewer than the chart is wide wastes the space;
more than that cannot be drawn.

## See also

- [BarChart](bar-chart.md) - when the categories are already decided
- [Heatmap](heatmap.md) - a distribution over two axes
