---
title: Chat
parent: Components
nav_order: 9
has_children: true
---

# Chat

The components of an agent chat, shipped as their own package.

```bash
npm install @textui/chat
```

They are built on `@textui/core` and `@textui/widgets`, and on nothing that talks to a host.
A conversation is drawn from data the caller already has, so a client that speaks AHP, or anything else, maps its own records onto these shapes and the components never learn where a session came from.

```tsx
import { ChatComposer, ChatTranscript } from '@textui/chat';
import type { Block } from '@textui/chat';
import { Column } from '@textui/widgets';

const blocks: Block[] = [
  { kind: 'said', id: 's1', turnId: 't1', text: 'Rename the package.' },
  { kind: 'prose', id: 'p1', turnId: 't1', content: 'Done. Three files changed.', streaming: false },
];

<Column flex={1}>
  <ChatTranscript blocks={blocks} expanded={{}} onToggle={() => {}} flex={1} />
  <ChatComposer value="" onChange={() => {}} onSubmit={() => {}} />
</Column>
```

## The conversation

[`ChatTranscript`](chat/chat-transcript.md) is the whole thing: a list of [`Block`](chat/transcript-blocks.md)s in a `Feed`, which owns the viewport, the cursor and the tail it follows.

Each kind of block draws as its own component.
A thing said is a [`ChatBubble`](chat/chat-bubble.md) - a speaker's glyph and name over a [`Gutter`](chat/gutter.md) that runs down the left of the answer.
Prose still arriving is [`StreamingText`](chat/streaming-text.md), and what the agent was thinking is a [`ReasoningBlock`](chat/reasoning-block.md) folded to one row.
What the agent did is a [`ToolCallRow`](chat/tool-call-row.md), which opens onto the input and the output.

A turn is not a block: an agent turn is a header, some prose, a reasoning fold and a row per tool call, and each of those folds and selects on its own.
Whoever owns the turns turns them into these.

## The composer

[`ChatComposer`](chat/chat-composer.md) is the field, the slash and path menus above it, and the control rows under it.
The field is `TextArea` from the catalog; what is here is what enter means while a turn is running, which completions the draft has earned, and how much room a short terminal leaves for the menu.

[`ComposerBar`](chat/composer-bar.md) is the row of chips under the field.
Everything on it is a current value rather than a label - which harness, which model, how much it may do before it asks, where it runs - and each chip is one command's argument, asked through [`openPicker`](chat/chat-helpers.md) above the chip that asked.
The mark in front of a value comes from [`settingIcon` and `valueIcon`](chat/setting-icons.md), which are hints rather than decisions: an unrecognised setting keeps every word the host gave it.

[`CommandList`](chat/command-list.md) is the menu itself, extracted so a caller with a different list of commands does not have to re-derive the column arithmetic.

## Waiting on a person

[`ChatHitl`](chat/chat-hitl.md) is the block that means the agent is stopped.
It is the only thing on the screen that is waiting on the reader, so it takes the focus and is answerable without leaving the keyboard.
A tool confirmation and a request in prose are two different things and it renders both.

[`ChatInputStatus`](chat/chat-input-status.md) is the row under it saying what came of the answer.

## Sessions

[`SessionList`](chat/session-list.md) is the catalogue, two lines to a row, and [`ConnectionBadge`](chat/connection-badge.md) says which host it came from.

[`ChatSessionHead`](chat/chat-session-head.md) is what a conversation is, drawn as the first thing inside the transcript so it costs nothing after the first screen.
[`SessionDetails`](chat/session-details.md) is the pane where the identifiers are read in full and copied.

## Changes

[`FileDiff`](chat/file-diff.md) is one file out of a changeset with both sides lined up, and [`diffLines`](chat/line-diff.md) works out which lines those were.

## Its own shapes

Every component takes a shape of this package's own: a `ChatToolCall`, a `ChatSession` whose status is already a word, a tone and a glyph, a `ChatPendingInput` with its questions.
They are all on one page with the functions that read them: [`Chat data`](chat/chat-data.md).

Nothing is read from the store.
The markdown switch, the draft answers of a question and the row under the composer are all props, and whoever mounts the components holds them wherever it likes.

## See also

- [Feed](display/feed.md) - the viewport under the transcript
- [MarkdownView](display/markdown-view.md) - how a message is laid out
- [Focus](../platform/focus.md) - the scopes the waiting block and the composer use
