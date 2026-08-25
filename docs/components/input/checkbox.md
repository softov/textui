---
title: Checkbox
parent: Controls and forms
grand_parent: Components
---

# Checkbox
{: .no_toc }

An independent on/off, with a third indeterminate state.

```tsx
import { Checkbox } from '@textui/widgets';

<Checkbox label="Notify on failure" checked onChange={(checked) => console.log(checked)} />
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `label` | `string` |  |  |
| `checked` | `boolean` | `false` |  |
| `indeterminate` | `boolean` |  | Neither checked nor unchecked - a parent of mixed children. |
| `onChange` | `(checked: boolean) => void` |  |  |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Role: `checkbox`.

Space toggles it. `indeterminate` is the "some of the children" state for a parent checkbox; it is a display state only, and the next toggle resolves to checked.

Use a checkbox when the options are independent. When exactly one of several must be chosen, that is a [`RadioGroup`](radio-group.md), and when the thing takes effect immediately rather than on submit it reads better as a [`Switch`](switch.md).

## See also

- [Editing keys and selection](editing.md) - the keys, the selection and the clipboard
- [Switch](switch.md) - the same boolean, different promise
- [RadioGroup](radio-group.md) - one of several
- [Field](field.md) - wrapping it in a form
