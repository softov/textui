---
title: Marquee
parent: Display and data
grand_parent: Components
---

# Marquee
{: .no_toc }

Text too long for its box, read by sliding it while it has the cursor.

```tsx
import { Marquee } from '@textui/widgets';

<Marquee content="a service name far too long for the column it is in" active />
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `content` | `string` | **required** |  |
| `active` | `boolean` | `false` | Slide, or rest. Off is the resting state and the common one: a list of twenty rows is twenty still labels, and the one under the cursor is the one that moves. It is also what keeps the cost honest - a marquee that is not sliding holds no ticker at all, so a menu is one animation and not one per row. |
| `speed` | `number` | `8` | Cells a second. |
| `dwell` | `number` | `900` | How long it waits at each end, in milliseconds. |
| `fps` | `number` | `10` |  |

Plus everything on [`TextProps`](../base-props.md).
<!-- props:end -->

Role: `marquee`.

Only ever a last resort for text that genuinely cannot fit. It moves, and
movement in a terminal is expensive attention - so `active` gates it, and the
usual thing to gate it on is whether the row has the cursor. A list of twenty
sliding labels is unreadable; one sliding label under the selection is useful.

`speed` is cells per second, `dwell` the pause at each end in milliseconds,
and `fps` how often it repaints. Lowering `fps` costs smoothness and saves
redraws, which matters over ssh.

Where truncation is acceptable it is nearly always the better answer -
[`text`](../primitives/text.md) with `truncate="middle"` keeps both ends of a
path visible and never moves.

## See also

- [text](../primitives/text.md) - `truncate` and `wrap`, the static answers
- [List](list.md) - where `active` usually comes from
