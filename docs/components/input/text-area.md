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
| `caretStyle` | `'underline' \| 'block'` |  | What the caret looks like. **The theme's `cursor` by default**, so the drawn caret and the terminal's own are the same shape, and an underline when the theme leaves it to the terminal. Both **mark a cell rather than occupying one**. The caret used to be a glyph pushed in between the text before it and the text after, so every character to its right sat one column off from where it would be once the caret moved on, and the row was a cell wider than its own text. On a wrapped row that extra cell is the one that does not fit. That is also why the theme's `bar` arrives here as an underline: a bar *between* two characters is exactly the caret this one is not. |
| `copyOnSelect` | `boolean` | `true` | Put a selection on the system clipboard as it is made. On by default. Selecting with the mouse is how text leaves a terminal, and an application that reports mouse events has taken the terminal's own select-and-copy away - so it owes one back. The copy goes out over OSC 52 and into the store, which is the half a paste inside the application can read. |
| `blink` | `boolean` | `true` | Blink the caret while the field has the keyboard. On by default. Driven by the animation ticker, so it stops with every other animation - a still, a test and a terminal that has animation off all draw the caret solid rather than at whatever phase the clock happened to be in. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Role: `textbox`.

The caret **marks the cell it is on** - an underline under the character by default, or a filled cell with `caretStyle="block"`. It does not occupy a cell of its own: as a glyph pushed in between the text before and after it, every character to its right sat one column from where it would be once the caret moved on, and the row came out a cell wider than its own text. Past the last character there is nothing to mark and a space stands in, which is the one place the caret adds a column - at the end, where nothing moves.

Long lines **soft-wrap**. A logical line can take several rows, and everything that counts rows counts rows: `maxRows` is a budget of screen, `up` and `down` move to the row above and below rather than jumping a whole paragraph, and the scroll offset follows the caret's row. The inherited `wrap` prop chooses how a line breaks, and its `truncate-*` values ask for one row per line with an ellipsis instead.

A newline is `ctrl+enter`, with `alt+enter` as the one that cannot fail - **never `shift+enter`**, which no terminal can tell apart from plain `enter`. Passing `onSubmit` is what makes enter mean "done"; without it enter is a newline like any other key.

`ctrl+enter` is three different byte sequences depending on the terminal, and `@textui/terminal` decodes all of them: the kitty protocol's `CSI 13;5u`, xterm's `modifyOtherKeys` `CSI 27;5;13~`, and a bare LF. The last is the common one, and it is not the Return key: in raw mode Return sends CR, so LF reaching an application is `ctrl+Return`.

It also settles the question a single-letter keybinding raises. The focused node is offered a key *before* any keybinding, so while a text field has the keyboard, `q` is a letter. That is what lets an application with a composer in it keep `n`, `r` and `d` as commands - and why a global `q` for quit only works where nothing happens to be reading it.

`onOverflow` fires when the cursor tries to leave the top or the bottom, which is how a composer inside a list hands focus back.

## Selecting with the mouse

A click puts the caret where it landed. A **drag selects**, and the release puts what was selected on the system clipboard over OSC 52 - and into the store, which is the half a paste inside the application can read back. `copyOnSelect={false}` keeps the selection and skips the clipboard.

That is a debt rather than a feature. Reporting mouse events takes the terminal's own select-and-copy away, so an application that reads the mouse has to hand one back, or text that is on the screen cannot leave it.

Dragging past the edge of the field **scrolls it** rather than stopping at the last row on screen. The drag arrives at all because the application holds the pointer for whoever took the button down: mouse dispatch is otherwise a hit test, and a selection dragged past the field is the pointer being somewhere the field is not.

A **double click takes the run under it** - letters with letters, spaces with spaces, punctuation with punctuation, so a double click in the gap between two words takes the gap rather than one of the words. A newline joins nothing, so a word selection never runs across a line break. A **third click takes the logical line** with its break, not the row it happened to be drawn on: a wrapped paragraph is one thing somebody wrote. A fourth comes back round to a caret.

None of that arrives from the terminal. The wire reports presses and releases and has no notion of a double click, so it is arithmetic on `MouseEvent.at` and the cell: same cell, inside 450ms, or it is a new gesture.

`shift` with `left`, `right`, `up`, `down`, `home` and `end` extends the selection from wherever it was anchored; the same keys without `shift` collapse it. A selection made this way **copies too** - highlighted and on the clipboard are the same thing, or it is a selection you have to make again with the mouse.

`ctrl+left` and `ctrl+right` move a word at a time, and with `shift` select one. A line break is a step of its own: walking right stops at the end of the line and the next press crosses to the one below, because the end of a line is somewhere people mean to be.

Typing replaces a selection, `backspace` and `delete` remove it, and `escape` clears it - which is why `onCancel` is documented as escape *when there is nothing inside the field to cancel*.

## Selecting text this field does not own

Only this component has a selection. The transcript, a viewer, the output of a tool call - anything drawn by something that is not a text field - has no selection of its own yet.

**`shift` and drag** is the answer meanwhile, and it needs no code. An application that reports mouse events has taken the terminal's own select-and-copy, and every terminal worth using keeps a way to get it back: holding `shift` while dragging bypasses mouse reporting entirely and gives you the terminal's own selection, its own highlight and its own copy. xterm, iTerm2, Ghostty, WezTerm, Kitty, Alacritty and the VS Code terminal all do it, and the text it copies is whatever is on the screen - agent output included.

It is worth saying in an application's own key hints, because a reader whose first drag selected nothing has no way to guess it.

## See also

- [TextInput](text-input.md) - one line, and enter submits
- [Keybindings](../../platform/keybindings.md) - why the focused node wins
