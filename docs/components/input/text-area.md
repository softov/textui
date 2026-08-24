---
title: TextArea
parent: Controls and forms
grand_parent: Components
---

# TextArea
{: .no_toc }

A paragraph: grows to what has been typed, then scrolls.

```tsx
import { TextArea } from '@textui/widgets';

<TextArea value="" onChange={(value) => console.log(value)} maxRows={6} />
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `value` | `string` | **required** |  |
| `onChange` | `(value: string) => void` | **required** |  |
| `onSubmit` | `(value: string) => void` |  | Enter. A newline is `ctrl+enter`, which is the one people reach for, with `alt+enter` as the one that cannot fail. A terminal has three ways to say `ctrl+enter` and `@textui/terminal` decodes all three: the kitty protocol's `CSI 13;5u`, xterm's `modifyOtherKeys` `CSI 27;5;13~`, and a bare LF - which is what most terminals send, and which is *not* the Return key, because in raw mode Return sends CR. `shift+enter` is not offered. There is no encoding in which it differs from enter, so a field that claimed it would be claiming a key that cannot arrive. Left off, enter inserts a newline like every other key does. |
| `onCancel` | `() => void` |  | Escape, when there is nothing inside the field to cancel. |
| `onOverflow` | `(direction: -1 \| 1) => void` |  | Up at the top, down at the bottom: for walking a history. |
| `onEdge` | `(edge: 'start' \| 'end') => void` |  | Left at the very start, right at the very end. The horizontal pair of `onOverflow`, and separate from it because they mean different things: up and down walk a history, and left off the front of the field is "I am done here" - which is how a composer hands the reader back to what is beside it without them reaching for escape. |
| `placeholder` | `string` |  |  |
| `maxRows` | `number` | `6` | Rows before it stops growing and starts scrolling. |
| `maxLength` | `number` |  |  |
| `autoFocus` | `boolean` |  |  |
| `focusId` | `string` |  |  |
| `caretTone` | `'default' \| 'primary' \| 'secondary' \| 'accent' \| 'success' \| 'warning' \| 'danger' \| 'info' \| 'muted'` |  | The caret's colour. `cursor` by default, which is the theme's own. A composer usually wants `accent`: the caret is the one thing on the screen saying where typing goes, and the field it sits in is the point of the screen. |
| `blink` | `boolean` | `true` | Blink the caret while the field has the keyboard. On by default. Driven by the animation ticker, so it stops with every other animation - a still, a test and a terminal that has animation off all draw the caret solid rather than at whatever phase the clock happened to be in. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Role: `textbox`.

A newline is `ctrl+enter`, with `alt+enter` as the one that cannot fail -
**never `shift+enter`**, which no terminal can tell apart from plain `enter`.
Passing `onSubmit` is what makes enter mean "done"; without it enter is a
newline like any other key.

`ctrl+enter` is three different byte sequences depending on the terminal, and
`@textui/terminal` decodes all of them: the kitty protocol's `CSI 13;5u`,
xterm's `modifyOtherKeys` `CSI 27;5;13~`, and a bare LF. The last is the
common one, and it is not the Return key: in raw mode Return sends CR, so LF
reaching an application is `ctrl+Return`.

It also settles the question a single-letter keybinding raises. The focused
node is offered a key *before* any keybinding, so while a text field has the
keyboard, `q` is a letter. That is what lets an application with a composer in
it keep `n`, `r` and `d` as commands - and why a global `q` for quit only
works where nothing happens to be reading it.

`onOverflow` fires when the cursor tries to leave the top or the bottom,
which is how a composer inside a list hands focus back.

## See also

- [TextInput](text-input.md) - one line, and enter submits
- [Keybindings](../../platform/keybindings.md) - why the focused node wins
