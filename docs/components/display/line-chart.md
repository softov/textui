---
title: LineChart
parent: Display and data
grand_parent: Components
---

# LineChart
{: .no_toc }

One or more series on a braille grid, with axes.

```tsx
import { LineChart } from '@textui/widgets';

<LineChart
  series={[{ label: 'p95', values: [12, 18, 15, 22, 19] }]}
  chartHeight={8}
/>
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `series` | `Series[]` | **required** |  |
| `min` | `number` |  |  |
| `max` | `number` |  |  |
| `chartWidth` | `number` |  |  |
| `chartHeight` | `number` | `8` |  |
| `axis` | `boolean` | `true` | Draw a y-axis with the bounds labelled. |
| `area` | `boolean` | `false` | Fill under the line. |
| `format` | `(value: number) => string` |  |  |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Plotted on a 2×4 braille grid, so a 40×8 chart really has 80×32 plot positions. Where braille is unavailable it falls back to block levels and still reads.

Several `series` overlay on shared axes; each carries its own `label` and `tone`. `min` and `max` fix the scale, which matters whenever two charts sit side by side.

## See also

- [AreaChart](area-chart.md) - the same chart, filled
- [Sparkline](sparkline.md) - when one row is enough
- [Capabilities](../../terminal/capabilities.md) - what happens without braille
