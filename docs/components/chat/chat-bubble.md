---
title: ChatBubble
parent: Chat
grand_parent: Components
---

# ChatBubble
{: .no_toc }

One thing said: who is speaking, a rule down the left, and a body that owns the rest of the width.

```tsx
import { ChatBubble } from '@textui/chat';

<ChatBubble speaker="agent" author="claude" meta="4.1s">
  <text content="Three files changed." wrap="word" />
</ChatBubble>
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `speaker` | `'user' \| 'agent' \| 'system'` | **required** |  |
| `author` | `string` |  | The name, when the speaker is not enough: a model, a person, a host. |
| `meta` | `string` |  | Right of the author line: a time, a duration, a model. |
| `tone` | `'default' \| 'primary' \| 'secondary' \| 'accent' \| 'success' \| 'warning' \| 'danger' \| 'info' \| 'muted'` |  |  |
| `active` | `boolean` |  | The transcript's cursor is on this block: the bar runs down its left column, in place of the speaker's glyph on the first row and in the gutter under it. |
| `children` | `unknown` |  |  |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

A bubble in a terminal is not a rounded rectangle, because the width is 80 cells and half of it spent on alignment is half the conversation gone.
The gutter is one column of glyph and one of rule, which is what makes a wrapped paragraph read as one person talking rather than as the page starting again.

`speaker` picks both the glyph and the word: `user` is the theme's chevron and "you", `agent` a filled bullet and "agent", `system` the info glyph and "system".
`author` replaces the word with a model, a person or a host, and `meta` goes to the right of it - a time, a duration, a model.

`active` runs the cursor bar down the block's left column, taking the glyph's own cell on the first row rather than adding a column, so the block does not move when the cursor arrives.
It is a different glyph rather than only a different colour, so it survives a session without colour.
`tone` overrides the speaker's colour, which is how one turn is painted in the danger tone without becoming another speaker.

## See also

- [Gutter](gutter.md) - the rule on its own, for a block that is not something said
- [ChatTranscript](chat-transcript.md) - the bubbles in a conversation
- [Themes](../../themes/tokens.md) - where the speaker's glyph and colour come from
