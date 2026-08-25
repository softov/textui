---
title: Menu
parent: Navigation and overlays
grand_parent: Components
---

# Menu
{: .no_toc }

A list of commands, with shortcuts and submenus.

```tsx
import { Menu } from '@textui/widgets';

<Menu
  items={[
    { id: 'open', label: 'Open', shortcut: 'ctrl+o' },
    { id: 'save', label: 'Save', shortcut: 'ctrl+s', separatorBefore: true },
  ]}
  onSelect={(id) => console.log(id)}
/>
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `items` | `MenuItem[]` | **required** |  |
| `onSelect` | `(id: string, item: MenuItem) => void` |  |  |
| `visibleRows` | `number` |  | Rows shown at once. |
| `activeId` | `string` |  |  |
| `autoFocus` | `boolean` |  |  |
| `interactive` | `boolean` | `true` | Take focus and handle keys. Off when something else drives the selection - a command palette, where typing belongs to the search field and the list only follows. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Role: `menu`.

`shortcut` draws the chord; it does not register it. The keybinding is still [`app.keybindings.register`](../../platform/keybindings.md), and the menu is saying out loud what the chord already does.

`separatorBefore` puts a rule above an item, which is how a destructive action gets separated from the ones above it. `children` nests a submenu.

`interactive={false}` renders it as a static list - for a cheat sheet or a help pane rather than a menu.

## See also

- [CommandPalette](command-palette.md) - searching the command registry instead
- [Toolbar](toolbar.md) - the same actions along a row
- [Commands](../../platform/commands.md) - what the ids should refer to
