---
title: ReasoningBlock
parent: Chat
grand_parent: Components
---

# ReasoningBlock
{: .no_toc }

What the agent was thinking, one row until it is asked for.

```tsx
import { ReasoningBlock } from '@textui/chat';

<ReasoningBlock content="The lock file changed, so the install is the suspect." onToggle={() => {}} />
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `content` | `string` | **required** |  |
| `expanded` | `boolean` |  |  |
| `streaming` | `boolean` |  |  |
| `summary` | `string` |  | Shown collapsed: "thought for 12s". |
| `markdown` | `boolean` |  | Passed to the text once opened. |
| `match` | `string` |  | Text to pick out, for the find box. Handed to the text inside it. |
| `onToggle` | `() => void` |  | Clicking the summary row opens it, and closes it again. |
| `active` | `boolean` |  | The transcript's cursor is on this block. The block takes the `selected` background and its words turn `inverted`, the theme's own rule for that tone: a quiet grey on the selection blue is a row you can find and cannot read. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Reasoning arrives from the host like any other prose and is not what the reader came for, so it is one row until it is asked for.
Dropping it instead loses the only account of why a turn did what it did.

Collapsed, the row is a chevron and `summary` - "thought for 12s" - or a count of the words, which is pluralised through i18n; while `streaming` it says "thinking" instead.
`onToggle` is called when the row is clicked, and the whole row takes the hover fill rather than the glyph the pointer is over.

`expanded` draws the content as a quiet `StreamingText` and closes it with a `Divider`, because without a line under it the reader cannot tell where the thinking stopped and the answer began.
`markdown` is passed through to that text.
`active` puts the selection on the header row alone and its words in the theme's own `inverted`, which is a quiet grey on the selection blue otherwise.

## See also

- [StreamingText](streaming-text.md) - what an opened reasoning block draws
- [ChatTranscript](chat-transcript.md) - where the fold is keyed and toggled
- [Divider](../layout/divider.md) - the rule that closes it
