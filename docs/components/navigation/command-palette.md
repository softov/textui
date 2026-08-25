---
title: CommandPalette
parent: Navigation and overlays
grand_parent: Components
---

# CommandPalette
{: .no_toc }

Search the command registry and run what you find.

```tsx
import { CommandPalette } from '@textui/widgets';

<CommandPalette placeholder="Run a command" onClose={() => {}} />
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `commands` | `CommandDefinition[] \| (() => CommandDefinition[])` |  | Rows to search. Defaults to every enabled command in the `palette` slot. A function is re-read every render, which is what a list of switches needs: after one is flipped the row has to show its new state, and a snapshot taken when the palette opened cannot. |
| `placeholder` | `string` |  |  |
| `onRun` | `(id: string, args?: Record<string, unknown>) => void` |  | Notified after a command runs. The palette runs it itself. |
| `onClose` | `() => void` |  |  |
| `execute` | `boolean` | `true` | Off makes this a picker: it reports the choice and runs nothing. |
| `grouped` | `boolean` | `true` | Group the list by `category`, with the category named above each group. Only while nothing is typed. A query sorts by relevance, which interleaves the categories - and a heading over one row is not a group. |
| `visibleRows` | `number` | `8` |  |
| `width` | `number` |  | A fixed width, in cells. Left off, the panel is as wide as its widest row and no wider than `maxWidth` - which is what a list of five short answers wants, and what a list of five sentences needs. A number here is a number: the panel is that wide whether the rows fill it or overflow it. |
| `maxWidth` | `number` | `60` | The widest the panel may grow when `width` is left off. 60 by default. There is always a limit: a description is prose, and prose has no width it stops at. Past this the rows truncate, and the row under the cursor slides what it truncated. |
| `descriptions` | `'inline' \| 'below'` | `'inline'` | Where a row's description goes. `inline` right-aligns it beside the label; `below` gives it a line of its own. `below` for a question whose answers differ by a sentence rather than by a word - four approval modes named in two words each are told apart by the line under them, and inline that line is the half that gets truncated. Every row costs two lines, so `visibleRows` buys half as many. |
| `openAt` | `string` |  | Open already drilled into this command's choices. For a caller that has decided *which* question is being asked and only wants the palette to ask it - a menu item for "Theme" should offer the themes, not the whole command list with "Theme" typed into the search box. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Role: `dialog`.

It searches the **command registry**, not a list you pass it. Anything registered with the `palette` slot is in it, which means a feature becomes reachable by registering a command and doing nothing else.

That is the whole argument for commands over handlers: the palette, the keybinding and the menu item cannot drift apart, because there is one implementation and three ways in.

`commands` overrides the registry for the rare screen that wants its own list; `execute={false}` reports the choice through `onRun` instead of running it.

## See also

- [Commands](../../platform/commands.md) - registering and the `palette` slot
- [Menu](menu.md) - a fixed list rather than a search
