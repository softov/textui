---
title: Editing keys and selection
parent: Controls and forms
grand_parent: Components
nav_order: 1
---

# Editing keys and selection
{: .no_toc }

What every control does with the keyboard, in one place, so a component page
can say what is different about *it* rather than repeat this.

## The focused node is offered a key first

Before any keybinding. While a text field has the keyboard, `q` is a letter -
which is what lets an application with a composer in it keep `n`, `r` and `d`
as commands, and why a global single-letter binding only fires where nothing
happens to be reading it.

That is the rule behind most of the surprises on this page. A key that "does
nothing" in a field is usually a key the field claimed, and a key that does
nothing *outside* one is usually a binding scoped to somewhere else. See
[Keybindings](../../platform/keybindings.md).

## Moving

| Key | What it does |
| --- | --- |
| `left` `right` | One character |
| `ctrl+left` `ctrl+right` | One word |
| `up` `down` | One **row**, not one line - a soft-wrapped line is several rows |
| `home` `end` | Start and end of the **line**, not of the field |
| `pageup` `pagedown` | A screenful, where the control scrolls |

A line break is a step of its own for the word keys: walking right stops at the
end of a line, and the next press crosses to the one below. The end of a line
is somewhere people mean to be.

`up` and `down` counting rows rather than lines is the same decision made
everywhere in this library: everything that counts rows counts rows. A
paragraph that wrapped into four rows is four presses to cross, because that is
what it looks like on the screen.

## Selecting

| Key | What it does |
| --- | --- |
| `shift` + any move key | Extends the selection from where it was anchored |
| A move key without `shift` | Collapses it |
| `escape` | Clears it |
| Any character | Replaces it |
| `backspace` `delete` | Removes it |

A selection made with the keyboard **goes to the clipboard as it is made**.
Highlighted and copied are the same thing here, or it is a selection you would
have to make again with the mouse to be able to use.

`escape` clearing the selection is why `onCancel` is documented as escape *when
there is nothing inside the field to cancel*: the field spends the key first.

## Selecting with the mouse

| Gesture | What it takes |
| --- | --- |
| Click | Puts the caret there |
| Drag | Selects, and scrolls the field if it leaves the edge |
| Double click | The **run** under it - letters, spaces or punctuation |
| Triple click | The **logical line**, with its break |
| Fourth click | Back to a caret |

A double click takes a run rather than a word, so a double click in the gap
between two words takes the gap rather than guessing which word was meant. A
newline joins nothing, so a word selection never runs across a line break. A
triple click takes the line somebody wrote, not the row it was drawn on - a
wrapped paragraph is one thing.

None of that arrives from the terminal. The wire reports presses and releases
and has no notion of a double click, so it is arithmetic on `MouseEvent.at` and
the cell: the same cell within 450ms, or it is a new gesture.

The drag arrives at all because the application holds the pointer for whoever
took the button down. Mouse dispatch is otherwise a hit test, and a selection
dragged past the bottom of a field is the pointer being somewhere the field is
not.

## Getting the text out

Copy and paste are the **terminal's**, not the application's, and the shortcut
depends on the emulator - `Ctrl+Shift+C` on most Linux terminals, `Cmd+C` on
macOS, `Shift+Insert` as the most portable paste. The table is on
[The clipboard](../../terminal/clipboard.md), along with why `Ctrl+C` could
never have been it.

Two consequences matter while writing an application:

- **Reporting the mouse takes the terminal's own select-and-copy away.** A
  control that reads the mouse owes a selection back, or text on the screen
  cannot leave it. Where no component owns the text - a transcript, a viewer,
  the output of a tool call - **`shift` and drag** bypasses mouse reporting and
  gives the terminal's selection back. It is worth saying in an application's
  key hints, because nobody guesses it.
- **An application can write the clipboard but not read it.** `OSC 52` has no
  usable read half, on purpose. `useClipboard` writes to the terminal *and* to
  the store, and the store is the half a paste inside the application can read.

## Enter, and the key that does not exist

Enter submits where a control offers `onSubmit`; otherwise it is a newline like
any other key.

A newline in a multi-line field is `ctrl+enter`, with `alt+enter` as the one
that cannot fail. **Never `shift+enter`** - there is no encoding in which it
differs from plain `enter`, so a field claiming it would be claiming a key that
cannot arrive.

`ctrl+enter` is three different byte sequences depending on the terminal, and
`@textui/terminal` decodes all three: the kitty protocol's `CSI 13;5u`, xterm's
`modifyOtherKeys` `CSI 27;5;13~`, and a bare LF. The last is the common one,
and it is *not* the Return key: in raw mode Return sends CR, so an LF reaching
an application is `ctrl+Return`.

The same collision catches `ctrl+m`, `ctrl+i` and `ctrl+j`. They are the bytes
for Return, Tab and `ctrl+Return`, so binding one of them means binding those
keys - only a terminal speaking the kitty protocol or `modifyOtherKeys` can
tell them apart. **`alt+<letter>` has no such problem**: it arrives as `ESC`
then the letter, which survives `ssh`, tmux and a console that has never heard
of either protocol. It is the modifier to reach for when a plain letter is
already a letter.

## Leaving a control

`onOverflow` fires when the cursor tries to leave the top or the bottom, and
`onEdge` when it walks off the front or the end of the text. They mean
different things: up and down walk a history, and left off the front of a field
is "I am done here" - which is how a composer hands the reader back to what is
beside it without anybody reaching for escape.

## See also

- [TextArea](text-area.md), [TextInput](text-input.md) - the controls this
  mostly describes
- [The clipboard](../../terminal/clipboard.md) - the copy and paste table
- [Keybindings](../../platform/keybindings.md) - scopes, and why the focused
  node wins
- [Focus](../../platform/focus.md) - what has the keyboard in the first place
