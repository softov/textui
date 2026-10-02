---
title: ChatComposer
parent: Chat
grand_parent: Components
---

# ChatComposer
{: .no_toc }

The field, the slash and path menus above it, and the control row under it.

```tsx
import { ChatComposer } from '@textui/chat';

<ChatComposer
  value=""
  onChange={() => {}}
  onSubmit={() => {}}
  options={[{ id: 'model', label: 'claude', commandId: 'chat.model' }]}
  onOption={() => {}}
/>
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `value` | `string` | **required** |  |
| `onChange` | `(value: string) => void` | **required** |  |
| `onSubmit` | `(value: string) => void` | **required** |  |
| `onCancel` | `() => void` |  |  |
| `onHistory` | `(direction: -1 \| 1) => void` |  |  |
| `onLeave` | `() => void` |  | Left off the front of the field: out of the composer entirely. |
| `running` | `boolean` |  | A turn is running: enter queues rather than sends, and stop is offered. |
| `queued` | `number` | `0` |  |
| `options` | `ComposerOption[]` | `[]` | The control row. Each is a value, and each may open a picker. |
| `onOption` | `(option: ComposerOption, anchorId: string) => void` |  |  |
| `placeholder` | `string` |  |  |
| `commands` | `ChatCommand[]` | `[]` | Offered when the draft starts with a slash. |
| `commandWidth` | `number` |  | The width the slash menu's name column is at least. The menu is a table - the name, what it does, where it came from - and a column that takes each row's own name is a column that moves with the filter, so the description starts somewhere different on every row. Short names are padded to this width and a longer name widens the column, since a floor is not a cut. Left unset it is `COMMAND_WIDTH`. |
| `commandDescription` | `{ /** Lines a description may occupy. One by default. */ lines?: number; /** Whether it wraps into those lines instead of being cut on the first. */ wrap?: boolean; }` |  | How the slash menu draws a command's description. `lines` is how many it may occupy, one by default; `wrap` says whether it wraps into those lines or is cut on the first. Unwrapped, `lines` buys nothing: the rows after the first would be empty, so the row stays one line. Wrapped, the row is `lines` tall and the menu shows proportionally fewer of them. |
| `onCommand` | `(command: ChatCommand) => void` |  | One of `commands` was chosen from the slash menu. The whole command rather than its id, because the two kinds go different places and only the command knows which it is. A `client` command is *ours*: it opens a screen, changes a setting or picks a theme, and none of that is a message - sending it down the session channel would put "/theme" in the transcript and ask the agent to make sense of it. A `session` command is a skill the host contributed, and the only way to invoke one is to send its name as the message. A slash the menu does not match is left alone and sent, which is how a command the host offers but did not list still reaches it. |
| `paths` | `ChatCompletion[]` | `[]` | What the host offers to complete the word the caret is in. Fetched rather than filtered: a path is a path on the *host's* filesystem, so which of them match what has been typed is a question only it can answer, and the answer changes with every keystroke. |
| `onPath` | `(path: ChatCompletion) => void` |  | One of `paths` was chosen. The range it replaces is on the completion. |
| `autoFocus` | `boolean` |  |  |
| `focusId` | `string` | `'chat.composer'` |  |
| `onMeasure` | `(rect: Rect \| null) => void` |  | Where the composer is on screen whenever that changes, and `null` once it is gone. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

The field itself is `TextArea` from the catalog - growing, scrolling and giving back the keys it does not want is not a chat problem.
What is here is the rest of a composer: what enter means while a turn is running, the menu over what has already been typed, and the control rows.

A draft that starts with a slash and holds no space is a completion over the commands, filtered by id and title with the host's session commands first; any other draft offers the `paths` the host returned for the word the caret is in.
Paths are fetched rather than filtered, because a path is a path on the host's filesystem and which of them match changes with every keystroke.

The menu is sized from the terminal: it takes at least three rows and no more than what the composer can spare, so a short screen does not get a menu on top of a field with no room to type in it.
Enter on a highlighted command goes to `onCommand`, on a highlighted path to `onPath`, and otherwise to `onSubmit`; a slash the menu did not match is left alone and sent, which is how a command the host offers but did not list still reaches it.
Up and down walk the menu, and the field's history when there is none.
Escape dismisses the menu for exactly that draft and it comes back the moment another character makes it a different question; with no menu it is `onCancel`.
`onMeasure` reports where the box is whenever that changes and `null` once it is gone, because the menu grows the box upward.

`commandWidth` and `commandDescription` are passed to the `CommandList`, and the control row is `ComposerBar`, whose options are `ComposerOption`s.

## See also

- [ComposerBar](composer-bar.md) - the chips under the field
- [CommandList](command-list.md) - how the menu draws a command
- [TextArea](../input/text-area.md) - the field itself
