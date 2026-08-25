---
title: FormActions
parent: Controls and forms
grand_parent: Components
---

# FormActions
{: .no_toc }

The submit and cancel row, already laid out.

```tsx
import { FormActions } from '@textui/widgets';

<FormActions submitLabel="Save" onCancel={() => {}} />
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `submitLabel` | `string` | `'Submit'` |  |
| `cancelLabel` | `string` | `'Cancel'` |  |
| `onCancel` | `() => void` |  |  |
| `tone` | `'default' \| 'primary' \| 'secondary' \| 'accent' \| 'success' \| 'warning' \| 'danger' \| 'info' \| 'muted'` | `'primary'` |  |
| `requireDirty` | `boolean` | `false` | Disable submit until something changed. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Inside a [`Form`](form.md) it wires itself to the form's submit and disables the button while the form is invalid or submitting - which is why the initial values are validated immediately, so `form.valid` is usable from the first frame rather than only after a keystroke.

`requireDirty` additionally disables submit until something has changed, for a settings screen where saving an unedited form is a pointless write.

## See also

- [Editing keys and selection](editing.md) - the keys, the selection and the clipboard
- [Form](form.md) - what it submits
- [Button](button.md) - for an action that is not a form submission
