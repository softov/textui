---
title: CommandList
parent: Chat
grand_parent: Components
---

# CommandList
{: .no_toc }

The completion menu: a name, what it does and where it came from.

```tsx
import { CommandList } from '@textui/chat';

<CommandList
  items={[
    { id: 'review', label: '/review', description: 'Review the working tree', meta: 'git' },
    { id: 'theme', label: '/theme', description: 'Pick a theme', meta: 'client' },
  ]}
  selectedId="review"
/>
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `items` | `CommandItem[]` | **required** |  |
| `selectedId` | `string` |  |  |
| `commandWidth` | `number` | `COMMAND_WIDTH` | The least the name column gets. A longer name widens it. |
| `descriptionLines` | `number` | `1` | Lines a description may occupy. One by default. Read with `wrapDescription`: unwrapped, a description is one line however many are allowed, because the rest would be empty rows. |
| `wrapDescription` | `boolean` | `false` | Whether a description wraps into those lines or is cut on the first. Wrapped, the row is as tall as `descriptionLines` and the cut carries the theme's ellipsis when the text still does not fit. Unwrapped, every row is one line and a long description is cut with the same ellipsis. |
| `availableLines` | `number` |  | Lines the menu may occupy here, which decides how many rows fit. A row is `descriptionLines` tall when descriptions wrap, so the same space holds proportionally fewer of them. Left out, the list measures its own box. |
| `marker` | `boolean` |  | Draw the marker column for the selected row. Off unless asked for. |
| `focusable` | `boolean` | `false` | The list's own keyboard. A completion menu is driven by its field. |
| `emptyMessage` | `string` |  |  |
| `onSelect` | `(id: string, item: CommandItem) => void` |  |  |
| `onActivate` | `(id: string, item: CommandItem) => void` |  |  |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Extracted from `ChatComposer` because the rows are the whole of what a menu is, and a caller with a different list of commands should not have to re-derive the column arithmetic.

The menu is a table: one width for the name column across every row, so the description starts at the same cell on the row the reader is on and on the rows around it.
That width comes from this component's own measured box rather than the terminal, because a composer in a split pane is not the whole screen; the first frame is measured at zero and the terminal stands in until the layout has run.

The name column starts at `commandWidth`, widens to the longest name, and stops where the description would have less than sixteen cells - a name cut short is still recognisable, and the description is what tells two similarly named skills apart.
`descriptionLines` and `wrapDescription` decide how tall a row is and whether a description wraps into those lines or is cut on the first; unwrapped, a description is one line however many are allowed.
`availableLines` converts the room into rows, so a menu that does not fit scrolls rather than dropping what it offers.

The selection, the keys and the window are the `List`'s.
`focusable` is off by default, because a completion menu is driven by its field.

## See also

- [ChatComposer](chat-composer.md) - the menu over the field
- [List](../display/list.md) - the list all of this is drawn with
- [CommandPalette](../navigation/command-palette.md) - the registry-wide version
