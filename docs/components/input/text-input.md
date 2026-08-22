---
title: TextInput
parent: Controls and forms
grand_parent: Components
---

# TextInput
{: .no_toc }

A single line of text, with a real terminal cursor.

```tsx
import { TextInput } from '@textui/core';

<TextInput label="Name" value="" onChange={(value) => console.log(value)} />
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `value` | `string` | **required** |  |
| `onChange` | `(value: string) => void` |  |  |
| `onSubmit` | `(value: string) => void` |  |  |
| `placeholder` | `string` |  |  |
| `label` | `string` |  |  |
| `hideLabel` | `boolean` |  | Keep the label as the field's name but do not draw it inside the field - for a form or a dialog that already shows it beside or above the input. |
| `mask` | `string` |  | Replace every character, for secrets. |
| `maxLength` | `number` |  | Stop accepting input past this many characters. |
| `autoFocus` | `boolean` |  |  |
| `search` | `boolean` |  | Draw a search glyph before the field. |
| `focusId` | `string` |  | A stable focus id, so a command can send the reader here by name. Without one a control's id is derived from its instance, which nothing outside the render can know - so "focus the filter" has nothing to name and the key that would do it cannot be written. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Role: `textbox`.

It publishes a **real cursor position** when the terminal has a cursor, so the
caret is where typing lands rather than a drawn approximation. That means
counting the label and any glyph before it, and scrolling the value sideways to
keep the caret in view on a field narrower than its contents.

`hideLabel` keeps the label as the field's accessible name without drawing it,
for a form or a dialog that already shows it.

`focusId` is worth setting. Without one the focus id is derived from the
instance, which nothing outside the render can know - so a command meaning
"focus the filter" has nothing to name.

## See also

- [TextArea](text-area.md) - more than one line
- [SearchBox](search-box.md) - the same field with a glyph and a count
- [Field](field.md) - label, hint and validation around it
