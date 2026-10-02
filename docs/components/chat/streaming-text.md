---
title: StreamingText
parent: Chat
grand_parent: Components
---

# StreamingText
{: .no_toc }

Text that is still being said, with the caret on the last word.

```tsx
import { StreamingText } from '@textui/chat';

<StreamingText content="The field is a **TextArea**, so a message can be a paragraph." streaming />
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `content` | `string` | **required** |  |
| `streaming` | `boolean` |  | Still arriving. Draws a caret and keeps it on the last word. |
| `quiet` | `boolean` |  |  |
| `maxLines` | `number` |  |  |
| `markdown` | `boolean` |  | Draw it as markdown, or as the characters that arrived. Markdown unless told otherwise. An application with a switch for this passes it here; nothing is read from anywhere else. |
| `match` | `string` |  | Text to pick out, for the find box. Coloured wherever it appears. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

`content` is drawn as markdown unless `markdown` is `false`, which shows the characters that arrived instead.
Raw is a `text` and not a `MarkdownView` told not to parse, because anything that lays a document out has already decided some of those characters were structure.

`streaming` appends the theme's caret and keeps it on the end of the content.
The caret is part of the content rather than a node beside it, because a caret placed after the block sits under the last line instead of at the end of it.
It blinks on the theme's own ticker and only while something is arriving, so animation being off - a pipe, a test, a `--static` capture - leaves a steady caret rather than a missing one, and a settled paragraph does not ask for a redraw twice a second for ever.

`quiet` drops it to the muted tone, `maxLines` caps how much of the markdown is drawn, and `match` colours a term from the find box wherever it appears.

## See also

- [ReasoningBlock](reasoning-block.md) - the same text, folded away
- [MarkdownView](../display/markdown-view.md) - what a markdown block is drawn by
- [text](../primitives/text.md) - the raw path, and `match`
