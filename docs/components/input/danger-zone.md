---
title: DangerZone
parent: Controls and forms
grand_parent: Components
---

# DangerZone
{: .no_toc }

A destructive action, fenced off and optionally typed to confirm.

```tsx
import { DangerZone } from '@textui/widgets';

<DangerZone
  description="Deletes the namespace and everything in it."
  actionLabel="Delete namespace"
  confirmText="billing"
  onAction={() => {}}
/>
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `title` | `string` | `'Danger zone'` |  |
| `description` | `string` |  |  |
| `actionLabel` | `string` | **required** |  |
| `onAction` | `() => void` |  |  |
| `confirmText` | `string` |  | Require typing this exact text before the action is enabled. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

`confirmText` is the part worth using: the action stays disabled until the
reader types that exact string. For anything irreversible that is a better
guard than a confirmation dialog, which people dismiss by reflex.

Put it last. A destructive action among ordinary fields is one mis-aimed
keystroke from happening.

## See also

- [Dialog](../navigation/dialog.md) - confirming something less final
- [FormActions](form-actions.md) - the ordinary submit row
