---
title: ConfirmDialog
parent: Navigation and overlays
grand_parent: Components
---

# ConfirmDialog
{: .no_toc }

The two-button dialog behind the `confirm` helper.

```tsx
import { ConfirmDialog } from '@textui/widgets';

<ConfirmDialog
  title="Delete the branch?"
  message="This cannot be undone."
  confirmLabel="Delete"
  cancelLabel="Keep"
  tone="danger"
  onConfirm={() => {}}
  onCancel={() => {}}
/>
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `title` | `string` |  |  |
| `message` | `string` | **required** |  |
| `confirmLabel` | `string` |  |  |
| `cancelLabel` | `string` |  |  |
| `tone` | `'default' \| 'primary' \| 'secondary' \| 'accent' \| 'success' \| 'warning' \| 'danger' \| 'info' \| 'muted'` |  |  |
| `onConfirm` | `() => void` |  |  |
| `onCancel` | `() => void` |  |  |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Role: `dialog`.

Usually reached through the app's `confirm` helper rather than mounted by
hand - that opens it on the modal layer and resolves a promise with the answer.
The buttons are the dialog's, not the caller's, so the order and the widths are
the same wherever it is used.

`tone` colours the confirming button, which is where a destructive action says
so - see [`DangerZone`](../input/danger-zone.md) when the guard should be typed
instead of clicked.

## See also

- [Dialog](dialog.md) - when the choice is not yes or no
- [PromptDialog](prompt-dialog.md) - when the answer is a string
- [Layers](../../platform/layers.md) - trapping and dismissal
