---
title: StatusBar
parent: Navigation and overlays
grand_parent: Components
---

# StatusBar
{: .no_toc }

The bottom line: segments at the left, segments at the right.

```tsx
import { StatusBar } from '@textui/core';

<StatusBar
  leading={[{ id: 'branch', label: 'main' }]}
  trailing={[{ id: 'pos', label: '12:4' }]}
/>
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `leading` | `StatusSegment[]` | `[]` | Segments before the gap and after it. Named `leading`/`trailing` rather than `left`/`right` because those are style props on every node. |
| `trailing` | `StatusSegment[]` | `[]` |  |
| `separator` | `string` |  |  |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Role: `contentinfo`.

`leading` and `trailing` rather than `left` and `right`, so the component
still reads correctly under a right-to-left locale.

Each segment carries its own `tone`, which is how one indicator goes red
without the bar changing colour.

## See also

- [KeyHints](key-hints.md) - the other thing that usually lives on this line
- [BarLayout](../surfaces/bar-layout.md) - a surface arranged as a bar
