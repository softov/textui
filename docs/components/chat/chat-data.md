---
title: Chat data
parent: Chat
grand_parent: Components
nav_order: 1
---

# Chat data

The shapes every chat component is told in, from `@textui/chat`.

```tsx
import type { ChatSession } from '@textui/chat';

const session: ChatSession = {
  id: 'ahp://host/1b444e78-d050',
  title: 'Rename the package',
  provider: 'claude',
  status: { activity: 'idle', archived: false, read: true, label: 'idle', tone: 'muted', glyph: 'bulletHollow' },
  createdAt: '2025-01-01T09:00:00Z',
  modifiedAt: '2025-01-01T09:30:00Z',
  workingDirectories: ['/srv/api'],
};
```

These are view shapes, not a protocol.
A client that speaks the Agent Host Protocol, or anything else, maps its own records onto them and the components never learn where a session or a tool call came from.
The field names follow AHP's where one exists, so that mapping is a pick rather than a rename - but nothing here is imported from it, and nothing here says how a session is fetched.

## A tool call

`ChatToolCall` is flat: the fields that are not there yet are absent rather than null.

| Field | What it is |
| --- | --- |
| `id` | The host's id for the call. |
| `name` | What the row calls it. |
| `toolName` | The tool's own id, where it differs from the display name. Many tools share one display name - every subagent is "Explore" or "Plan" and the tool under all of them is `Task` - so both are searchable. |
| `status` | `pending`, `pending-confirmation`, `running`, `completed`, `failed` or `cancelled`. |
| `input` | The command, which is the only thing separating twenty identical rows. |
| `invocation` | The one line the host gives for the call. Preferred over the input on the row, because the input of a subagent or an edit is a block of JSON. |
| `intention` | What it meant to do, as markdown. |
| `progress` | What it is doing right now, read only while `running`. |
| `outcome` | What it did, in the past tense. |
| `output` | What came back. |
| `exitCode` | A non-zero one reads as failed. |
| `files` | What it touched. |
| `confirmationTitle`, `options` | Set while `pending-confirmation`. |

## A session

`ChatSessionStatus` carries a word, a tone and a glyph together.
None of the three is allowed to be the only carrier, because a piped log keeps the word, a 16-colour terminal keeps the glyph, and a reader who cannot see the colour keeps both.

| Status field | What it is |
| --- | --- |
| `activity` | `input`, `running`, `error` or `idle`, already decoded. |
| `archived`, `read` | The other two states a catalogue row filters on. |
| `label` | The word, as the host or the client reads it. |
| `tone` | `warning`, `accent`, `danger` or `muted`. |
| `glyph` | A theme glyph name: `bulletHalf`, `bulletFilled`, `cross` or `bulletHollow`. |

`ChatSession` is one row of the catalogue and the head over a conversation.
Most of it is what the host said: `id`, `title`, `provider`, `createdAt`, `modifiedAt`, `workingDirectories`, `project`, `branch`, `activity` and `origin`.
`pullRequest` is already a label - `#412 merged` - because which host key holds the number and which the state is the client's to know, and the row has one line to say it on.
`changes` is a count of files, additions and deletions.

## A question

`ChatQuestion` is one thing to answer: an `id`, a `kind`, a `message`, whether it is `required`, the `options` for a select, and `allowFreeformInput` for answering in words instead of choosing.

`kind` is `text`, `number`, `integer`, `boolean`, `single-select` or `multi-select`, and it decides the shape of the answer.
`ChatAnswer` names that shape rather than leaving it to be guessed: `text`, `number`, `boolean`, `selected` for one option id, or `selected-many` for a list of them.

## What is waiting

`ChatPendingInput` is the union the waiting block renders.

`ChatToolConfirmation` is a yes or a no about a command, and carries the `ChatToolCall` it is about.
`ChatInputRequest` carries no tool call at all: its `message` is prose and its `questions` are what is being asked.

## The composer's own

`ChatCompletion` is one entry of the path menu: what to `insertText`, the `rangeStart` and `rangeEnd` of the fragment it replaces, a `label` and an optional `description`.

`ChatCommand` is one entry of the slash menu: an `id`, a `kind` of `client` or `session`, a `title`, an optional `description` and `from`, and a `hint` saying what goes after the name - `/autocompact <tokens>` says more about a command than a sentence describing it, and the row is the name.

`ChatSendStatus` is the row under the composer, and says only whether something has gone to the host or has not: a `state` of `sending` or `failed`, and its `text`.

## See also

- [Transcript blocks](transcript-blocks.md) - the other shape the transcript is told in
- [ChatTranscript](chat-transcript.md) - what draws them
- [ChatHitl](chat-hitl.md) - where a pending input is answered
