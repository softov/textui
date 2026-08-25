---
title: RadioGroup
parent: Controls and forms
grand_parent: Components
---

# RadioGroup
{: .no_toc }

Exactly one of several options.

```tsx
import { RadioGroup } from '@textui/widgets';

<RadioGroup
  label="Theme"
  options={[
    { value: 'plain', label: 'Plain' },
    { value: 'console', label: 'Console' },
  ]}
  value="plain"
  onChange={(value) => console.log(value)}
/>
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `options` | `RadioOption[]` | **required** |  |
| `value` | `string` |  |  |
| `onChange` | `(value: string) => void` |  |  |
| `label` | `string` |  |  |
| `inline` | `boolean` |  | Lay the options out in a row instead of a column. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Role: `radio`.

The whole group is one stop in the tab order and the arrow keys move within it, which is what a group of radios is supposed to do and what a row of checkboxes cannot.

`inline` lays them along a row. Past about four options a [`Select`](select.md) costs one row instead of four and is easier to scan.

## See also

- [Editing keys and selection](editing.md) - the keys, the selection and the clipboard
- [Select](select.md) - the same choice, collapsed
- [Checkbox](checkbox.md) - when more than one may be true
