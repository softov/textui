---
title: ResourceActions
parent: Surfaces, shells and resources
grand_parent: Components
---

# ResourceActions
{: .no_toc }

The actions registered for this resource kind.

```tsx
import { ResourceActions } from '@textui/documents';

<ResourceActions resource={null} slot="context" onRun={(id) => console.log(id)} />
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `resource` | `Resource \| null` | **required** |  |
| `slot` | `string` | `'context'` |  |
| `onRun` | `(actionId: string) => void` |  |  |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Reads the action registry rather than a list you pass, so an extension adding an action to a kind appears here without anything being rewired.

`slot` selects where the actions were registered to appear - `context` for a menu, other slots for a toolbar or a header.

## See also

- [Viewers, editors and actions](../../documents/viewers.md)
- [Menu](../navigation/menu.md) - what usually renders them
