---
title: Field
parent: Controls and forms
grand_parent: Components
---

# Field
{: .no_toc }

A label, a control, a hint and whatever error the form has for it.

```tsx
import { Field, TextInput } from '@textui/widgets';

<Field name="email" label="Email" hint="We only use this for alerts" required>
  <TextInput value="" onChange={() => {}} />
</Field>
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `name` | `string` | **required** |  |
| `label` | `string` |  |  |
| `hint` | `string` |  |  |
| `required` | `boolean` |  |  |
| `labelWidth` | `number` |  | Cells reserved for the label, so a column of fields lines up. |
| `stacked` | `boolean` |  | Label above the control rather than beside it. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

`name` is how it finds its error in the surrounding [`Form`](form.md), so it must match the key in `initialValues`. Outside a form a field is just a labelled row, which is fine.

`labelWidth` aligns labels across fields that are not siblings. `stacked` puts the label above the control instead of beside it, which is what a narrow terminal wants.

## See also

- [Editing keys and selection](editing.md) - the keys, the selection and the clipboard
- [Form](form.md) - the context it reads from
- [TextInput](text-input.md), [Select](select.md) - what usually goes inside
