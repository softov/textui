---
title: ChatHitl
parent: Chat
grand_parent: Components
---

# ChatHitl
{: .no_toc }

The block that means the agent is stopped, waiting on a person.

```tsx
import { ChatHitl } from '@textui/chat';
import type { ChatPendingInput } from '@textui/chat';

const input: ChatPendingInput = {
  kind: 'toolConfirmation',
  id: 'q1',
  call: { id: 'c1', name: 'Bash', status: 'pending-confirmation', input: 'rm -rf build' },
};

<ChatHitl input={input} onApprove={() => {}} onDeny={() => {}} onAnswer={() => {}} />
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `input` | `ChatPendingInput` | **required** |  |
| `draft` | `Record<string, ChatAnswer>` |  | The answers so far, keyed by question id. Owned by whoever mounts this rather than by the block: a host may have an action for a draft answer precisely because another client can be looking at the same question, and a value only this box knows is one nobody else can see. Unused by a tool confirmation. |
| `onDraft` | `(next: Record<string, ChatAnswer>) => void` |  |  |
| `onApprove` | `(optionId?: string) => void` | **required** |  |
| `onDeny` | `() => void` | **required** |  |
| `onAnswer` | `(answers: Record<string, ChatAnswer>, accepted: boolean) => void` | **required** |  |
| `onEscape` | `() => void` |  | Leave it up, but give the keyboard back. |
| `onMeasure` | `(rect: Rect \| null) => void` |  | Where the block is on screen whenever that changes, and `null` once it is gone. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

It is the only thing on the screen that is waiting on the reader, so it is focused on arrival and answerable without leaving the keyboard.
It is not a block in the transcript, because one that scrolls away is a blocked agent that looks merely slow.

The two kinds are nothing alike.
A `toolConfirmation` is a yes or a no about a command, with the host's named options where it offers any; `a` approves, `d` denies, a digit approves that option, and escape is `onEscape`, which gives the keyboard back and leaves the block up.
A `chatInput` carries no tool call at all: its prose is the request's own message and what is being asked is its `questions`, and drawing it as a confirmation loses the choices, the question and the request.

The block is focused but not trapped.
Trapping read well - the answer is the only thing to do - and it was wrong, because you approve a command on the strength of what is written above it and a trap stops the transcript from being scrolled while it is up.
The keys that answer it are global, so they work from wherever the reader has gone.

A question's answers are `draft`, keyed by question id, and every change goes back out through `onDraft` rather than being held here - another client may be looking at the same question.
Enter sends, but only from inside the block, so a reader who has tabbed down to the composer to queue a message does not answer the question with it.
A required question with no answer keeps Send disabled, and accepting with nothing resumes the agent on the answers it already had.
`onMeasure` reports where the block is, because it sits above the composer and whoever keeps clear of one has to keep clear of both.

`ConfirmRequest` and `QuestionForm` are exported for a client that wants one of the two on its own; this component is the panel and the two.

## See also

- [ToolCallRow](tool-call-row.md) - the call a confirmation is about
- [Panel](../layout/panel.md) - the frame it is drawn in
- [Checkbox](../input/checkbox.md), [RadioGroup](../input/radio-group.md) - the question controls
