---
title: ToastHost
parent: Navigation and overlays
grand_parent: Components
---

# ToastHost
{: .no_toc }

Where toasts stack, and the layer they live on.

```tsx
import { ToastHost } from '@textui/widgets';

<ToastHost anchor="bottom-right" />
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `anchor` | `'top-right' \| 'bottom-right' \| 'top' \| 'bottom'` | `'bottom-right'` | Where the stack sits. Named `anchor` so it does not shadow `position`. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Mount one, once, near the root - or let a [shell](../surfaces/plain-shell.md) do it, which the shipped ones already do by giving the notification layer a home.

It listens for notifications and renders them on the notification layer, above everything except debug. `anchor` decides the corner.

## See also

- [Toast](toast.md) - the message
- [Layers](../../platform/layers.md) - why notifications are their own plane
