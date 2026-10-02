---
title: ChatSessionHead
parent: Chat
grand_parent: Components
---

# ChatSessionHead
{: .no_toc }

What a conversation is, at the top of it and scrolling with it.

```tsx
import { ChatSessionHead } from '@textui/chat';
import type { ChatSession } from '@textui/chat';

const session: ChatSession = {
  id: 'ahp://host/1b444e78-d050',
  title: 'Rename the package',
  provider: 'claude',
  status: { activity: 'running', archived: false, read: true, label: 'running', tone: 'accent', glyph: 'bulletHalf' },
  createdAt: '2025-01-01T09:00:00Z',
  modifiedAt: '2025-01-01T09:30:00Z',
  workingDirectories: ['/srv/api'],
  branch: 'main',
};

<ChatSessionHead session={session} model="claude-sonnet" chat="ahp://host/chat/1" />
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `session` | `ChatSession` | **required** |  |
| `model` | `string` |  | What the last turn ran on. A session has no model; each message has one. |
| `chat` | `string \| null` |  | The chat uri, when the host has said which one this dispatches to. |
| `settings` | `{ label: string; value: string }[]` | `[]` | The settings in force, by the host's own labels. |
| `present` | `{ clientId: string; displayName?: string }[]` | `[]` | Who else the host says is in this session. This client is in the list too - it adds itself on opening the view - so a session with nobody else in it has one entry and says nothing, which is the ordinary case. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

The first thing in the transcript rather than a band above it, and that is the whole design: a caption pinned outside the scrolling region costs a row of the conversation on every screen for ever, so it has to earn each one, which means one line, which means dropping most of what it is for.
Scrolled with the conversation it costs nothing after the first screen and can say everything, the way the top of a printed letter does.

The identifiers are the point.
They are what gets pasted into a shell or a bug report, they are exactly what does not fit anywhere else, and the catalogue's detail pane is a screen away from the conversation they belong to.

Only rows with a value are drawn: a blank branch reads as a detached head rather than as a host that does not report branches, and a row of empty values reads as a session the host would not talk about.
`model` is what the last turn ran on, because a session has no model and each message has one, and it is drawn beside the provider.
`settings` are the host's own labels and values, whatever the host chose to call them.
`chat` is the chat uri, drawn in full.
`present` lists who else is here only when more than one client is, because the one entry is this client.

The timestamps are the host's ISO rendered in whatever this machine calls a date; one that cannot be parsed is passed through as it arrived rather than shown as an invalid date.

## See also

- [SessionDetails](session-details.md) - the pane where an identifier is read whole
- [ChatTranscript](chat-transcript.md) - the conversation this heads
- [KeyValue](../display/key-value.md) - how the rows are drawn
