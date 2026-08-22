---
title: Timeline
parent: Display and data
grand_parent: Components
---

# Timeline
{: .no_toc }

Events in order, each with a time, a title and an optional note.

```tsx
import { Timeline } from '@textui/core';

<Timeline
  items={[
    { time: '09:02', title: 'Deploy started' },
    { time: '09:04', title: 'Health check failed', tone: 'danger', description: 'billing-worker' },
  ]}
/>
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `items` | `{ time?: string; title: string; description?: string; tone?: 'default' \| 'primary' \| 'secondary' \| 'accent' \| 'success' \| 'warning' \| 'danger' \| 'info' \| 'muted'; icon?: string; }[]` | **required** |  |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Ordered top to bottom, in the order given - the component does not sort, since
"most recent first" and "oldest first" are both right depending on whether you
are reading history or watching it happen.

`tone` marks an entry, which is what separates the failed step from the four
that worked.

## See also

- [Feed](feed.md) - entries whose height is whatever their text wrapped to
- [LogViewer](log-viewer.md) - lines arriving continuously, with a tail
