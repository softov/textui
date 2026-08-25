---
title: Progress
parent: Display and data
grand_parent: Components
---

# Progress
{: .no_toc }

A bar with its numbers stated.

```tsx
import { Progress } from '@textui/widgets';

<Progress label="Uploading" value={42} total={100} />
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `value` | `number` |  | 0..1. Omit for an indeterminate bar. |
| `total` | `number` | `1` |  |
| `label` | `string` |  |  |
| `showValue` | `boolean` | `true` | Show the percentage after the bar. |
| `tone` | `'default' \| 'primary' \| 'secondary' \| 'accent' \| 'success' \| 'warning' \| 'danger' \| 'info' \| 'muted'` | `'primary'` |  |
| `barWidth` | `number` |  |  |
| `labelWidth` | `number` |  | A fixed gutter for the label, so a stack of bars starts at one column. Labels are their own width otherwise, which is right for one bar and wrong for three: "download", "index" and "working" each push their track to a different place and the group reads as three unrelated widgets. Nothing here can measure its siblings, so whoever stacks them says. |
| `spacer` | `boolean` |  | Push the bar away from the label, to the right edge of the row. The label's cell stretches, so it stays at the left and the track ends up hard against the right - which is what makes a column of these read as a table rather than as a ragged stack. Different from `labelWidth`, which pads the *label* to a fixed gutter: use that when the bars should start at one column, and this when they should end at one. Needs a row wider than its contents to have any effect, so the caller has to have given it a width or a `flex`. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Role: `progressbar`.

`total` defaults to `1`, so a fraction works without arithmetic: `value={0.42}` and `value={42} total={100}` draw the same bar.

`showValue` is on by default, and turning it off is usually wrong - a bar with no number is a shape, and a reader cannot tell 80% from 85% by looking at eight cells.

Omitting `value` gives an indeterminate bar, for work whose size is not known yet.

## See also

- [Spinner](spinner.md) - work with no measurable progress at all
- [Gauge](gauge.md) - a level rather than a task
