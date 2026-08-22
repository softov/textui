---
title: Toast
parent: Navigation and overlays
grand_parent: Components
---

# Toast
{: .no_toc }

A message that arrives and leaves on its own.

```tsx
import { Toast } from '@textui/core';

<Toast tone="success" message="Deployed to eu-west-1" />
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `message` | `string` | **required** |  |
| `tone` | `'default' \| 'primary' \| 'secondary' \| 'accent' \| 'success' \| 'warning' \| 'danger' \| 'info' \| 'muted'` | `'info'` |  |
| `title` | `string` |  |  |
| `icon` | `string` |  |  |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Role: `status`.

The message itself. Placement, stacking and expiry belong to
[`ToastHost`](toast-host.md), and one is normally created through the app's
notify helper rather than mounted directly.

Never put anything in a toast that the reader must act on - it will be gone.

## See also

- [ToastHost](toast-host.md) - where they stack and when they leave
- [Alert](../display/alert.md) - a message that stays
