---
title: SessionList
parent: Chat
grand_parent: Components
---

# SessionList
{: .no_toc }

The catalogue of sessions, two lines to a row.

```tsx
import { SessionList } from '@textui/chat';
import type { ChatSession } from '@textui/chat';

const sessions: ChatSession[] = [{
  id: 's1',
  title: 'Rename the package',
  provider: 'claude',
  status: { activity: 'idle', archived: false, read: true, label: 'idle', tone: 'muted', glyph: 'bulletHollow' },
  createdAt: '2025-01-01T09:00:00Z',
  modifiedAt: '2025-01-01T09:30:00Z',
  workingDirectories: ['/srv/api'],
}];

<SessionList sessions={sessions} selectedId="s1" />
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `sessions` | `ChatSession[]` | **required** |  |
| `selectedId` | `string \| null` |  |  |
| `onSelect` | `(id: string) => void` |  |  |
| `onOpen` | `(id: string) => void` |  |  |
| `emptyMessage` | `string` |  |  |
| `focusId` | `string` |  |  |
| `autoFocus` | `boolean` |  |  |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Still a `List`: the selection, the keys, the window and the highlight are the list's, and reimplementing them is what the transcript already proved is a mistake.
What is ours is the row, because a session does not fit the one-line shape a list gives you for free.

It takes two lines, and the first one is why.
A title, a harness, a workspace and a status sharing a pane that is also sharing the terminal leaves every one of them truncated, and a truncated title beside a truncated id names neither the conversation nor the directory it is in.
So the title gets the width and everything that qualifies it goes underneath: the harness, then the project and the branch and the pull request the branch became, then what the host says it is doing and why it is here when nobody started it.

The status travels as a word, a tone and a glyph together, because none of them is allowed to be the only carrier.
The changes sit at the end of the second line - the file count, then the additions in green and the deletions in red, the way a diff says it.

The row under the cursor marquees its title and its second line, so the one row that is arbitrarily long reads itself out while the rest are truncated and still.
`onSelect` is the cursor moving and `onOpen` is the row being activated.

## See also

- [List](../display/list.md) - the component underneath
- [SessionDetails](session-details.md) - the pane beside it
- [ChatSessionHead](chat-session-head.md) - the same session at the top of its conversation
