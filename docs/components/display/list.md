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
| `items` | `T[]` | **required** | The rows. `T` is whatever the caller's own row type is, so long as it is a `ListItem` - which is what the built-in row needs and what `id` being the selection's name needs. Passing plain `ListItem`s is the ordinary case and `T` costs nothing there; a caller with a `renderItem` gets its own fields back on the way in rather than a lookup by id. |
| `selectedId` | `string` |  |  |
| `onSelect` | `(id: string, item: T) => void` |  |  |
| `onActivate` | `(id: string, item: T) => void` |  |  |
| `visibleRows` | `number` |  | Rows visible at once. Scrolls when there are more. |
| `emptyMessage` | `string` | `'Nothing here'` |  |
| `marker` | `boolean` | `true` | Draw a marker column for the selected row. Drawn either way. |
| `focusable` | `boolean` | `true` |  |
| `autoFocus` | `boolean` |  |  |
| `focusId` | `string` |  | A stable focus id, so a command - or the screen that owns this - can put the reader here by name. Without one the id comes from the instance, which nothing outside the render can know. |
| `renderItem` | `(item: T, state: ListItemState) => RenderOutput` |  | Draw one row's contents. The built-in row - icon, title, description, meta, on one line - is the shape most catalogues are, and it is what you get by leaving this alone. The moment a caller wants a different one, the repair is *not* another field on `ListItem` and another flag saying where to put it: that road ends with a component whose props are a small layout language, and it still cannot draw the row after next. So the row is the caller's, and everything a row cannot do for itself stays here: the selection, the keys that move it, the window that scrolls, the highlight, the marker column and the click. `state` is what the row cannot know - whether it is the selected one, and whether that selection is live. A row taller than one line has to say so with `itemHeight`. |
| `itemHeight` | `number` | `1` | Lines one row occupies, when `renderItem` draws more than one. The list scrolls by arithmetic rather than by measurement - it decides how many rows fit *before* anything is drawn, which is the only way a thousand rows cost the same as ten. That arithmetic is in lines, so a row that is two of them has to be declared, not discovered. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Role: `list`.

`onSelect` fires as the cursor moves; `onActivate` fires on enter. Keeping them apart is what lets a list drive a preview pane without opening something on every arrow key.

Hold `selectedId` in the store rather than inside the list when anything else needs to know what is selected - which is usually.

\`focusId\` gives the list a stable name, so a command meaning "focus the results" has something to address. Without one the id is derived from the instance and nothing outside the render can know it - the same reason [\`TextInput\`](../input/text-input.md) takes one.

How much it draws is decided by the props you pass, not by `visibleRows`: given `flex`, a `height` or a `maxHeight` it renders what fits and scrolls; given none of those it renders everything and grows. See [how much these draw](../display.md).

## See also

- [Table](table.md) - rows with columns
- [Tree](tree.md) - rows that nest
- [Feed](feed.md) - rows whose height is whatever their text wrapped to
