---
title: EmptyState
parent: Display and data
grand_parent: Components
---

# EmptyState
{: .no_toc }

Nothing here, and what to do about it.

```tsx
import { EmptyState } from '@textui/core';

<EmptyState
  title="No services"
  message="Nothing is registered in this namespace yet."
  hint="press n to add one"
/>
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `title` | `string` | **required** |  |
| `message` | `string` |  |  |
| `icon` | `string` |  |  |
| `hint` | `string` |  | Hint text: what the reader can do about it. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

`hint` is the part that earns the component. An empty list that says only
"No services" leaves the reader stuck; one that names the key out is the
difference between an empty state and a dead end.

Centre it with [`Center`](../layout/center.md) if it is standing in for a
whole pane.

## See also

- [ErrorState](error-state.md) - empty because something broke
- [Center](../layout/center.md) - for filling the region it replaces
