---
title: List
parent: Display and data
grand_parent: Components
---

# List
{: .no_toc }

Fixed-height rows with a selection and a keyboard.

```tsx
import { List } from '@textui/widgets';

<List
  items={[
    { id: 'api', label: 'api', meta: 'healthy' },
    { id: 'worker', label: 'billing-worker', meta: 'degraded', tone: 'warning' },
  ]}
  selectedId="api"
  onSelect={(id) => console.log(id)}
/>
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `items` | `ListItem[]` | **required** |  |
| `selectedId` | `string` |  |  |
| `onSelect` | `(id: string, item: ListItem) => void` |  |  |
| `onActivate` | `(id: string, item: ListItem) => void` |  |  |
| `visibleRows` | `number` |  | Rows visible at once. Scrolls when there are more. |
| `emptyMessage` | `string` | `'Nothing here'` |  |
| `marker` | `boolean` | `true` | Draw a marker column for the selected row. |
| `focusable` | `boolean` | `true` |  |
| `autoFocus` | `boolean` |  |  |
| `focusId` | `string` |  | A stable focus id, so a command - or the screen that owns this - can put the reader here by name. Without one the id comes from the instance, which nothing outside the render can know. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Role: `list`.

`onSelect` fires as the cursor moves; `onActivate` fires on enter. Keeping
them apart is what lets a list drive a preview pane without opening something
on every arrow key.

Hold `selectedId` in the store rather than inside the list when anything else
needs to know what is selected - which is usually.

\`focusId\` gives the list a stable name, so a command meaning "focus the
results" has something to address. Without one the id is derived from the
instance and nothing outside the render can know it - the same reason
[\`TextInput\`](../input/text-input.md) takes one.

How much it draws is decided by the props you pass, not by `visibleRows`:
given `flex`, a `height` or a `maxHeight` it renders what fits and scrolls;
given none of those it renders everything and grows. See
[how much these draw](../display.md).

## See also

- [Table](table.md) - rows with columns
- [Tree](tree.md) - rows that nest
- [Feed](feed.md) - rows whose height is whatever their text wrapped to
