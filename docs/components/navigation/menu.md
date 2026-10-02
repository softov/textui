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
    { id: 'save', label: 'Save', shortcut: 'ctrl+s' },
    { id: 'forget', label: 'Forget', tone: 'danger', separatorBefore: true },
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
| `descriptions` | `'inline' \| 'below'` | `'inline'` | Where a row's description goes. `inline` right-aligns it on the row, sharing the width with the label - which is the right shape for a word or two of state. `below` gives it a line of its own under the label, indented to it, which is the only shape that fits a sentence: inline, a list of modes whose whole difference is the sentence under each shows the same truncated half of every one. `below` makes every row two lines, so `visibleRows` buys half as much. |
| `interactive` | `boolean` | `true` | Take focus and handle keys. Off when something else drives the selection - a command palette, where typing belongs to the search field and the list only follows. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Role: `menu`.

`shortcut` draws the chord; it does not register it. The keybinding is still [`app.keybindings.register`](../../platform/keybindings.md), and the menu is saying out loud what the chord already does.

`separatorBefore` puts a rule above an item, which is how a destructive action gets separated from the ones above it. `sectionBefore` puts a **heading** there instead, naming the group the item starts - said once above the group rather than repeated in a column on every row, and taking the line the rule would have used rather than adding one. `children` nests a submenu.

`tone` colours a row - its label and its icon. The row under the cursor is the
exception: what is being chosen is drawn in the theme's `Menu.focused` colour,
so a tone there would be a second answer to a question the fill already
answered.

With no tone a row is drawn in the colour it inherits, which is the terminal's
own unless something states otherwise. A theme that wants the whole column in a
colour states it once, and that is also the only way to colour a menu you do not
render yourself - the rows inside a [`CommandPalette`](command-palette.md):

```ts
app.themes.register({
  id: 'house',
  extends: 'dark',
  components: { Menu: { base: { fg: 'text' } } },
});
```

`interactive={false}` renders it as a static list - for a cheat sheet or a help pane rather than a menu.

## See also

- [CommandPalette](command-palette.md) - searching the command registry instead
- [Toolbar](toolbar.md) - the same actions along a row
- [Commands](../../platform/commands.md) - what the ids should refer to
