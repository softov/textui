---
title: BarChart
parent: Display and data
grand_parent: Components
---

# BarChart
{: .no_toc }

Labelled bars, horizontal or vertical.

```tsx
import { BarChart } from '@textui/core';

<BarChart
  data={[
    { label: 'api', value: 42 },
    { label: 'worker', value: 17, tone: 'warning' },
  ]}
/>
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `data` | `{ label: string; value: number; tone?: 'default' \| 'primary' \| 'secondary' \| 'accent' \| 'success' \| 'warning' \| 'danger' \| 'info' \| 'muted' }[]` | **required** |  |
| `max` | `number` |  |  |
| `barWidth` | `number` | `20` | Cells the bars occupy, not counting labels. |
| `showValue` | `boolean` | `true` |  |
| `format` | `(value: number) => string` |  |  |
| `orientation` | `'horizontal' \| 'vertical'` | `'horizontal'` |  |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Horizontal by default, which is the right way round in a terminal: labels read
left to right and a vertical bar chart has nowhere to put them.

Per-bar `tone` marks one out. `max` fixes the scale so two charts can be
compared - without it each scales to its own largest value and the taller bar
means nothing.

## See also

- [Histogram](histogram.md) - buckets computed from raw values
- [Heatmap](heatmap.md) - two dimensions rather than one
