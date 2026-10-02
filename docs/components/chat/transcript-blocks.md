---
title: Transcript blocks
parent: Chat
grand_parent: Components
nav_order: 2
---

# Transcript blocks

What a transcript draws, one entry per row group, from `@textui/chat`.

```tsx
import { blockText, findBlocks, selectable } from '@textui/chat';
import type { Block } from '@textui/chat';

const blocks: Block[] = [
  { kind: 'prose', id: 'p1', turnId: 't1', content: 'Three files changed.', streaming: false },
  { kind: 'tool', id: 'c1', turnId: 't1', call: { id: 'c1', name: 'Bash', status: 'running', input: 'ls' } },
];

const hits = findBlocks(blocks, 'files');
const text = blocks[0] ? blockText(blocks[0]) : '';
const openable = blocks[0] ? selectable(blocks[0]) : false;
```

A turn is not a block.
An agent turn is a header, some prose, a reasoning fold and a row per tool call, and each of those scrolls, folds and selects on its own - so the client that owns the turns turns them into these.

## The kinds

| `kind` | What it carries |
| --- | --- |
| `said` | Something the reader typed: `text`. |
| `header` | The turn opening: `model`, `settings`, `meta` and a `state` of `running`, `complete`, `cancelled` or `failed`. |
| `prose` | What the agent is saying: `content` and whether it is `streaming`. |
| `reasoning` | What it was thinking: `content` and whether it is `streaming`. |
| `notice` | The harness saying something in passing: `content`. |
| `failure` | The turn stopping: `content` and whether it is `resumable`. |
| `tool` | A `ChatToolCall`. |
| `queued` | A message that has not been sent: `messageId`, `text` and the `model` the host will run it on, where the host said. |

Every kind also has an `id` and a `turnId`.

## Reading them

`selectable` says whether the cursor can land on a block: the ones that open, or can be withdrawn - `tool`, `reasoning` and `queued`.

`blockText` is everything in a block that a person could be looking for, as one searchable string.
A tool call is its name, its tool name, its command and what came back, because all of those are things somebody searches a transcript for, and the file a command touched is in the output and nowhere else.
A header is the model and the settings, which is how "where did I switch to opus" is answered.

`findBlocks` is where in the conversation a query appears, as block indices in order.
It is case-insensitive, and a blank query matches nothing rather than everything: a find with no term is a find that has not been typed yet, and lighting up every block for it is the opposite of what the box is for.

## See also

- [Chat data](chat-data.md) - the shapes a block is built from
- [ChatTranscript](chat-transcript.md) - what draws each kind
- [Feed](../display/feed.md) - the viewport and the cursor over them
