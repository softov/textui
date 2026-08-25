---
title: FormSection
parent: Controls and forms
grand_parent: Components
---

# FormSection
{: .no_toc }

A titled group of fields.

```tsx
import { FormSection } from '@textui/widgets';

<FormSection title="Notifications" description="Where alerts are sent.">
  <text content="fields go here" />
</FormSection>
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `title` | `string` | **required** |  |
| `description` | `string` |  |  |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Grouping only - it holds no form state and does not need to be inside a [`Form`](form.md).

Worth reaching for once a form is long enough that a reader scrolls it. Below about six fields it adds a heading to something that did not need one.

## See also

- [Editing keys and selection](editing.md) - the keys, the selection and the clipboard
- [Field](field.md) - the rows inside it
- [Panel](../layout/panel.md) - when the group wants a frame
