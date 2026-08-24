---
title: Gauge
parent: Display and data
grand_parent: Components
---

# Gauge
{: .no_toc }

One value against a range, with thresholds.

```tsx
import { Gauge } from '@textui/widgets';

<Gauge
  value={82}
  label="Disk"
  thresholds={[{ at: 75, tone: 'warning' }, { at: 90, tone: 'danger' }]}
/>
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `value` | `number` | **required** |  |
| `min` | `number` | `0` |  |
| `max` | `number` | `100` |  |
| `label` | `string` |  |  |
| `thresholds` | `{ at: number; tone: 'default' \| 'primary' \| 'secondary' \| 'accent' \| 'success' \| 'warning' \| 'danger' \| 'info' \| 'muted' }[]` | `[]` | Bands that colour the reading by range. |
| `format` | `(value: number) => string` |  |  |
| `gaugeWidth` | `number` | `20` |  |
| `spacer` | `boolean` |  | Push the gauge away from the label, to the right edge of the row. The label's cell stretches, so it stays at the left and the track ends up hard against the right - which is what makes a column of these read as a table rather than as a ragged stack. Needs a row wider than its contents to have any effect, so the caller has to have given it a width or a `flex`. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Role: `meter`.

`thresholds` are what makes this different from a
[`Progress`](progress.md) bar: the gauge recolours itself as the value crosses
each one, so "how full" and "is that bad" are one glance instead of two.

They are read in order, so list them ascending. `min` and `max` default to 0
and 100.

## See also

- [Progress](progress.md) - a task completing rather than a level
- [StatusDot](status-dot.md) - the state without the number
