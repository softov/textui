---
title: Gutter
parent: Chat
grand_parent: Components
---

<!-- docs:setup
import { Column, Row } from '@textui/widgets';
-->

# Gutter
{: .no_toc }

The rule down the left of a block: one cell wide and as tall as the block it is in.

```tsx
import { Gutter } from '@textui/chat';

<Column>
  <Row gap={1}>
    <Gutter />
    <text content="a wrapped answer keeps its rule down every line" wrap="word" flex={1} />
  </Row>
</Column>
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `active` | `boolean` |  | The transcript's cursor is on this block. A heavy bar in the accent colour, down the whole block. A different glyph rather than only a different colour, so it survives a session without colour - which a background does not. |
| `blank` | `boolean` |  | No rule at rest. For the blocks that are not something said - a tool row, a turn header - and still need the column, so the bar has a place to be drawn and their text starts where the prose does. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

A box that fills rather than a `text`: the text is one row tall and the paragraph beside it is nine, so a rule written as a character marks the first line of a wrapped answer and abandons the rest of it.

`active` fills with `cursorBar(theme)`, the heavy left rule of the theme's `bold` border, in the accent colour - from the theme, so an ascii terminal gets a glyph it can draw rather than a question mark.
`blank` fills with a space instead of the rule, for a block that is not something said - a tool row, a turn header - and still needs the column, so its text starts where the prose does.

In a `Row`, whose children are centred, it needs `alignSelf="stretch"` to reach the height of the block rather than sitting as a one-cell box in the middle of it.
`ChatBubble` and `ChatTranscript` set that for the blocks they draw.

## See also

- [ChatBubble](chat-bubble.md) - the rule with a speaker over it
- [box](../primitives/box.md) - `fill` and the border characters
- [Themes](../../themes/tokens.md) - `borderChars` and the `bold` family
