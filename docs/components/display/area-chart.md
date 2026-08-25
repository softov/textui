---
title: AreaChart
parent: Display and data
grand_parent: Components
---

# AreaChart
{: .no_toc }

A line chart with the area under it filled.

```tsx
import { AreaChart } from '@textui/widgets';

<AreaChart series={[{ label: 'requests', values: [4, 9, 6, 12, 11] }]} />
```

## Props

<!-- props:start -->
_No props of its own._
<!-- props:end -->

Identical to [`LineChart`](line-chart.md) but with `area` on - it takes the same props and is the same component underneath.

Filling reads as volume, which is right for a quantity accumulating and wrong for a rate that can fall - a filled dip looks like a hole rather than a lower number.

## See also

- [LineChart](line-chart.md) - unfilled, and the full prop list
- [Histogram](histogram.md) - a distribution rather than a series
