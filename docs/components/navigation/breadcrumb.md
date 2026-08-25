---
title: Breadcrumb
parent: Navigation and overlays
grand_parent: Components
---

# Breadcrumb
{: .no_toc }

Where you are, and every level you can go back to.

```tsx
import { Breadcrumb } from '@textui/widgets';

<Breadcrumb
  items={[
    { id: 'root', label: 'services' },
    { id: 'api', label: 'api' },
  ]}
  onSelect={(id) => console.log(id)}
/>
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `items` | `{ id: string; label: string; icon?: string }[]` | **required** |  |
| `onSelect` | `(id: string) => void` |  |  |
| `separator` | `string` |  |  |
| `maxItems` | `number` |  | Collapse the middle when it does not fit. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Role: `navigation`.

`maxItems` collapses the middle when the trail is longer than the width - first and last survive, since those are the two a reader actually uses.

The last item is where you are and is not selectable. `onSelect` fires for the others.

## See also

- [ResourceBreadcrumb](../surfaces/resource-breadcrumb.md) - the same trail from a resource URI
- [Tabs](tabs.md) - siblings rather than ancestors
