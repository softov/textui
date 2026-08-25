---
title: Switch
parent: Controls and forms
grand_parent: Components
---

# Switch
{: .no_toc }

A boolean that takes effect as soon as it moves.

```tsx
import { Switch } from '@textui/widgets';

<Switch label="Follow tail" value onChange={(value) => console.log(value)} />
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `label` | `string` |  |  |
| `value` | `boolean` | `false` |  |
| `onChange` | `(value: boolean) => void` |  |  |
| `labels` | `[off: string, on: string]` | `['off', 'on']` | Words either side, so the state reads without colour. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Role: `switch`.

The difference from [`Checkbox`](checkbox.md) is a promise to the reader, not a shape: a switch means the change has already happened, a checkbox means it will happen when the form is submitted. Putting a switch in a form with a Submit button breaks that promise.

`labels` renames the two states from `['off', 'on']`, for a control whose states have names of their own.

## See also

- [Editing keys and selection](editing.md) - the keys, the selection and the clipboard
- [Checkbox](checkbox.md) - when submission is what applies it
- [Button](button.md) - when it is an action rather than a state
