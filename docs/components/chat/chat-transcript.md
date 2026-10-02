---
title: ChatTranscript
parent: Chat
grand_parent: Components
---

# ChatTranscript
{: .no_toc }

The conversation as blocks in a `Feed`: said, header, prose, reasoning, notice, failure, tool and queued.

```tsx
import { ChatTranscript } from '@textui/chat';
import type { Block } from '@textui/chat';

const blocks: Block[] = [
  { kind: 'said', id: 's1', turnId: 't1', text: 'Rename the package.' },
  { kind: 'header', id: 'h1', turnId: 't1', model: 'claude', meta: '4.1s', state: 'complete' },
  { kind: 'prose', id: 'p1', turnId: 't1', content: 'Done. Three files changed.', streaming: false },
];

<ChatTranscript blocks={blocks} expanded={{}} onToggle={() => {}} flex={1} />
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `blocks` | `Block[]` | **required** |  |
| `expanded` | `Record<string, boolean>` | **required** |  |
| `onToggle` | `(id: string) => void` | **required** |  |
| `cursor` | `number` |  | Which block the cursor is on. Held by the screen, like every other state. |
| `onCursor` | `(index: number) => void` |  |  |
| `match` | `string` |  | What the find box is looking for. Passed down to be coloured where it appears, not to decide what is drawn: every block stays where it was and the ones holding the term light up, so a reader keeps the conversation around a hit instead of a filtered list of the lines that matched. |
| `pinCursor` | `boolean` |  | Keep the cursor in view rather than only when it moves. For the find box, which drives the cursor: its first hit is often the block the cursor is already on, and a feed that only scrolls on a change would leave that one off screen while the box counted it. |
| `head` | `RenderOutput` |  | What this conversation is, as the first thing in it. Inside the scrolling region rather than pinned above it: a caption outside costs a row of the conversation on every screen for ever, so it has to earn each one - which is what forces it down to a line and then down to less than it was for. Here it costs nothing after the first screen. It is not a block. The cursor walks the conversation and there is nothing to do to a caption, so it sits ahead of the indices rather than in them. |
| `focusId` | `string` | `'chat.transcript'` |  |
| `markdown` | `boolean` |  | Prose and reasoning as markdown (the default), or as the characters that arrived. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

There is no scrolling here.
`Feed` owns the viewport, the cursor and the tail it follows, because none of that is about chat - a transcript, an activity stream and search results with snippets are the same problem, which is entries that are not one line tall.
What is left is the only part that is about chat: which block draws as what.

`expanded` is keyed by block id and `onToggle` is handed one, so a tool row and a reasoning fold open out of the same map the caller owns.
`cursor` is an index into `blocks` and `onCursor` reports one back; `pinCursor` keeps the cursor in view even when the index did not change, which is what a find box that lands on the block the cursor is already on needs.
`match` colours a term through every block without filtering any of them out, so the conversation stays around a hit.
`head` is drawn as the first thing inside the scrolling region and is not a block, so it does not shift the indices the cursor walks.

Every block gets a one-cell left column the cursor is drawn in: a block that is something said keeps its rule, one whose first row already carries a glyph - the header's bullet, the user line's chevron - uses that glyph as its gutter, and the rest lead with a blank one so their text starts where the prose does.
A `queued` block says so and, under the cursor, says that enter drops it.

## See also

- [Feed](../display/feed.md) - the viewport, the cursor and the tail
- [ChatBubble](chat-bubble.md) - what a `said` block draws
- [ToolCallRow](tool-call-row.md) - what a `tool` block draws
