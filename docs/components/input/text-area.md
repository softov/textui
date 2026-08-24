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
| `onSubmit` | `(value: string) => void` |  | Enter. A newline is `alt+enter` or `ctrl+j`, because in every place a multi-line field is worth having, enter already means "done". Left off, enter inserts a newline like every other key does. |
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

A newline is `alt+enter` or `ctrl+j` - **never `shift+enter`**, which most
terminals cannot tell apart from plain `enter`. Passing `onSubmit` is what
makes enter mean "done"; without it enter is a newline like any other key.

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
