---
title: ToolCallRow
parent: Chat
grand_parent: Components
---

# ToolCallRow
{: .no_toc }

One tool call as a row, opening onto its input and output.

```tsx
import { ToolCallRow } from '@textui/chat';
import type { ChatToolCall } from '@textui/chat';

const call: ChatToolCall = {
  id: 'c1',
  name: 'Bash',
  status: 'completed',
  input: 'ls -la',
  output: 'total 8',
  exitCode: 0,
};

<ToolCallRow call={call} expanded onToggle={() => {}} />
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `call` | `ChatToolCall` | **required** |  |
| `expanded` | `boolean` |  |  |
| `active` | `boolean` |  | The transcript's cursor is on this row. |
| `onToggle` | `() => void` |  | Clicking the row opens it. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Twenty of these in a turn look identical unless the command is on the row, so the input is the row and the display name is a prefix.
The summary is the first of `progress`, `invocation`, `input` and `intention` that is there, flattened to one line, because a JSON object put straight on the row makes it three rows tall and floats the name beside the middle of a brace-delimited block.
`progress` wins while it is set: a subagent whose row says what it was asked for a minute is a row that says nothing.

Status is a glyph and a colour together - hollow for pending, half for pending confirmation, filled for running, a check for completed, a cross for failed and cancelled - so a 16-colour session, a piped log and a colourblind reader all keep the glyph.
`exitCode` that is a non-zero number also reads as failed, and the code is drawn as a badge.

The chevron is there only when the row opens onto something: `intention` as markdown when it says more than the row already does, `input` on its own lines, the first twelve lines of `output` with a count of the rest, the `files` and the `outcome`.
`expanded` turns that on and `onToggle` is called when the row is clicked.
`active` selects the header row alone, so what it opens to is not painted with a background chosen for the canvas.

## See also

- [ChatTranscript](chat-transcript.md) - the row in a conversation
- [ChatHitl](chat-hitl.md) - a call that is waiting on a person
- [Badge](../display/badge.md) - the exit code and the asks badge
