---
title: Dialog
parent: Navigation and overlays
grand_parent: Components
---

# Dialog
{: .no_toc }

A modal panel with a title and a row of actions.

```tsx
import { Dialog } from '@textui/core';

<Dialog
  title="Delete namespace?"
  actions={[
    { id: 'cancel', label: 'Cancel' },
    { id: 'delete', label: 'Delete', tone: 'danger' },
  ]}
  onClose={() => {}}
>
  <text content="This cannot be undone." />
</Dialog>
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `title` | `string` |  |  |
| `actions` | `{ id: string; label: string; tone?: 'default' \| 'primary' \| 'secondary' \| 'accent' \| 'success' \| 'warning' \| 'danger' \| 'info' \| 'muted'; onPress?(): void }[]` | `[]` | Buttons along the bottom. The first is the default action. |
| `onClose` | `() => void` |  |  |
| `width` | `number` | `50` | Cells wide. The dialog centres itself in whatever is left. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Role: `dialog`.

Rendered on the modal [layer](../../platform/layers.md), which is what traps
focus inside it and dismisses it on escape - the dialog does not implement
either, and neither should anything else that needs them.

Actions are laid out for you, so OK and Cancel line up regardless of order -
see [`Button`](../input/button.md) on why `solid` and `outline` are the same
height.

## See also

- [PromptDialog](prompt-dialog.md) - a dialog that asks for a string
- [Layers](../../platform/layers.md) - trapping and dismissal
- [DangerZone](../input/danger-zone.md) - for irreversible actions, a better guard
