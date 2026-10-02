---
title: SessionDetails
parent: Chat
grand_parent: Components
---

# SessionDetails
{: .no_toc }

A property list you can walk, where the selected value is shown whole and enter copies it.

```tsx
import { SessionDetails } from '@textui/chat';

<SessionDetails
  fields={[
    { id: 'harness', label: 'Harness', value: 'claude' },
    { id: 'session', label: 'Session', value: 'ahp://host/1b444e78-d050' },
  ]}
/>
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `fields` | `DetailField[]` | **required** |  |
| `focusId` | `string` |  |  |
| `labelWidth` | `number` |  | Width of the label column, where a caller wants to fix it. Left off, it is the widest label there is. It used to be a constant on the grounds that the labels were ours, and they are not: a session's settings and a model's options are named by whichever host is answering, in words this client does not choose, and the constant was one character wider than the longest label anybody had thought of. |
| `claim` | `boolean` |  | Take the keyboard on the frame this mounts, out of whatever holds it. Not `autoFocus`, which claims focus rather than taking it: a pane that appears *because* a key asked for it has to end up with the cursor, and the thing it is taking the cursor from - the session list - is in the same focus scope and already has it. It has to be done here rather than by the screen that mounts this, because a focusable registers in its own effect: on the render that opens the pane, the id does not exist yet and the screen's `focus()` is a call that quietly returns false. |
| `values` | `'selected' \| 'all'` | `'selected'` | Which rows show their value whole. `selected` is the default and the one that keeps the pane a list: every row is one line, and the row you have stopped on wraps to as many as its value needs. `all` wraps every row, which is what you want when the values *are* the point - a pane of URIs where the answer is on the third one down and reading it should not mean walking there first. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

The catalogue's detail pane is where the identifiers live, and an identifier you cannot read in full or paste anywhere is decoration.
`KeyValue` draws the same pairs and is static: nothing selects a row, so nothing can be copied and nothing can be shown untruncated.

Every row is one line with its value truncated and the selected row wraps its value across as many lines as it needs, which costs nothing when the value is short and is the whole answer when it is a URI in a 36-column pane.
`values="all"` wraps every row instead, which is what a pane of URIs wants.
`enter` writes the row's `value` to the clipboard - OSC 52 where the terminal takes it and the store either way, so a test can assert what was copied - and says "copied" until the cursor moves.
A row with no value shows `absent`, or a dash, in the subtle tone.

`parts` draws a value in pieces with a tone each - `3 files`, `+260`, `-31` - while `value` is still what is copied.
The label column is the widest label, floored at eleven cells and capped at twenty so one verbose title cannot take the pane from the values it labels, or `labelWidth`.

`claim` takes the keyboard on the frame this mounts, which is not `autoFocus`: a pane that appears because a key asked for it has to end up with the cursor, and the pane it takes it from is in the same focus scope.
It is done here rather than by the screen that mounts this, because a focusable registers in its own effect and the id does not exist yet on the render that opens the pane.

## See also

- [ChatSessionHead](chat-session-head.md) - the same identifiers over a conversation
- [KeyValue](../display/key-value.md) - the static version of this list
- [Clipboard](../../terminal/clipboard.md) - where a copied value goes
