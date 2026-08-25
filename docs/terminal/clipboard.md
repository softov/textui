---
title: The clipboard
parent: Terminal
nav_order: 5
---

# The clipboard

Copy and paste belong to the terminal emulator, not to the application running
inside it. There is no key an application can bind to mean "copy": the emulator
intercepts its own shortcut before any byte reaches the program, and what that
shortcut is depends on which emulator somebody is using.

`Ctrl+C` and `Ctrl+V` are not available to be that shortcut. `Ctrl+C` is
`0x03`, which is SIGINT, and `Ctrl+V` is `0x16`, which is literal-next in
readline and in vi's insert mode. Both bytes were spoken for decades before
anybody expected a terminal to talk to a system clipboard, so every emulator
had to pick something else - and they did not all pick the same thing.

## What the user's own terminal does

| Where | Copy | Paste |
| --- | --- | --- |
| GNOME Terminal, Konsole, most Linux | `Ctrl+Shift+C` | `Ctrl+Shift+V` |
| xterm | `Ctrl+Insert` | `Shift+Insert` |
| macOS Terminal.app, iTerm2 | `Cmd+C` | `Cmd+V` |
| Windows Terminal | `Ctrl+Shift+C` | `Ctrl+Shift+V` |
| X11, any terminal | select with the mouse | middle-click |

`Shift+Insert` is the most portable paste: xterm, GNOME Terminal, Konsole,
PuTTY and Windows Terminal all take it.

Inside a multiplexer it is a different mechanism again, because the multiplexer
has a buffer of its own between the application and the emulator:

- **tmux** - `prefix [` enters copy mode, `Space` starts the selection, `Enter`
  copies; `prefix ]` pastes. With `mode-keys vi`, `v` selects and `y` yanks.
- **screen** - `Ctrl+a [` for copy mode, `Ctrl+a ]` to paste.

None of this is configurable from here, and none of it should be documented as
though it were an application's key. It is worth knowing because it is the
answer to "how do I get this text out", and because an application can take it
away by accident - which is the next section.

## Mouse reporting takes the terminal's selection away

While an application reports mouse events, dragging sends those events to the
application instead of selecting text in the terminal. A reader whose first
drag selected nothing has no way to guess why.

**Holding `shift` while dragging** bypasses mouse reporting entirely and gives
back the terminal's own selection, highlight and copy. xterm, iTerm2, Ghostty,
WezTerm, Kitty, Alacritty and the VS Code terminal all honour it, and what it
copies is whatever is on the screen - including output no component owns.

An application that reports the mouse owes a selection back wherever it
reasonably can. [`TextArea`](../components/input/text-area.md) has one; a
transcript or a viewer does not yet, and `shift`-drag is the answer there.

## What an application *can* do

**Write.** `OSC 52` asks the terminal to put a string on the system clipboard,
and `useClipboard` uses it. That is how a selection made inside a component
reaches the clipboard without anybody pressing the emulator's copy key.

**Not read.** There is no read half in practice. `OSC 52` has a query form and
terminals disable it, because a page of output that could ask for the clipboard
is a page of output that could exfiltrate it. An application therefore cannot
"read the clipboard" - which is why `useClipboard` also writes into the store,
so a paste *inside* the application has something to read back.

Detection is not worth doing. Whether the terminal on the far end of an `ssh`
session will honour `OSC 52` cannot be told from the environment: `ssh` does
not forward `TERM_PROGRAM`, `KITTY_WINDOW_ID` or `WT_SESSION`, so a modern
terminal two hops away looks exactly like a dumb one. The sequence is ignored
harmlessly where it is unsupported, so it is sent unless the terminal is known
to mangle it.

Paste arrives on its own. The terminal types it at the application wrapped in
bracketed-paste markers, and `@textui/terminal` buffers the whole thing and
emits one paste event rather than a hundred keystrokes - which is what stops a
pasted newline from submitting a form halfway through the second line.

## See also

- [Capabilities](capabilities.md) - what else is detected, and what is assumed
- [Editing keys and selection](../components/input/editing.md) - the keys
  inside a text field, which *are* the application's
- [`TextArea`](../components/input/text-area.md) - the component with a
  selection model
