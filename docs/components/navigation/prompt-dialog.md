---
title: PromptDialog
parent: Navigation and overlays
grand_parent: Components
---

# PromptDialog
{: .no_toc }

A dialog that asks for one string.

```tsx
import { PromptDialog } from '@textui/widgets';

<PromptDialog
  title="Rename"
  message="New name for this service"
  initialValue="api"
  onSubmit={(value) => console.log(value)}
  onCancel={() => {}}
/>
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `title` | `string` |  |  |
| `message` | `string` |  |  |
| `placeholder` | `string` |  |  |
| `initialValue` | `string` | `''` |  |
| `mask` | `string` |  |  |
| `onSubmit` | `(value: string) => void` |  |  |
| `onCancel` | `() => void` |  |  |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Role: `dialog`.

Enter submits, escape cancels. `mask` turns it into a password field.

Usually reached through the app's `prompt` helper rather than mounted by hand - that opens it on the modal layer and resolves a promise with the answer, which is what calling code actually wants.

## See also

- [Dialog](dialog.md) - when the answer is a choice, not a string
- [TextInput](../input/text-input.md) - the field inside it
