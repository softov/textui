---
title: ChatInputStatus
parent: Chat
grand_parent: Components
---

# ChatInputStatus
{: .no_toc }

The row between the waiting block and the composer: what came of the answer.

```tsx
import { ChatInputStatus } from '@textui/chat';

<ChatInputStatus status={{ state: 'sending', text: 'Your answer is on its way' }} />
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `status` | `ChatSendStatus \| null` | **required** | Nothing to say is `null`, and no row. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

That row used to be blank, and it is where a person is already looking after pressing a button on the block above it.
A press that reaches a host which then says nothing is indistinguishable from a key that was never read, so this says the answer has gone and says so in the danger tone when it did not.

Nothing to say is `null` and no row at all: a status line that is always there is a row of chrome, and the composer is a row further from the conversation for the whole of every session in which nothing goes wrong.
`sending` leads with the hollow bullet this screen already uses for something in progress, rather than an ellipsis in front of a sentence that ends in one.

## See also

- [ChatHitl](chat-hitl.md) - the block the answer was given to
- [StatusDot](../display/status-dot.md) - the shared status vocabulary
