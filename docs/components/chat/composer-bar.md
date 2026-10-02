---
title: ComposerBar
parent: Chat
grand_parent: Components
---

# ComposerBar
{: .no_toc }

The composer control rows: what this message will be sent as, and the one verb.

```tsx
import { ComposerBar } from '@textui/chat';

<ComposerBar
  options={[{ id: 'model', label: 'claude', title: 'Model', commandId: 'chat.model' }]}
  onOpen={() => {}}
  onSend={() => {}}
/>
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `options` | `ComposerOption[]` | **required** |  |
| `onOpen` | `(option: ComposerOption, anchorId: string) => void` | **required** |  |
| `onSend` | `() => void` | **required** |  |
| `onLeave` | `() => void` |  | Escape on a chip: back to the field. |
| `running` | `boolean` |  | A turn is running, so this message joins the queue instead. |
| `queued` | `number` | `0` |  |
| `sendDisabled` | `boolean` |  |  |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Everything on the bar is a current value rather than a label: which harness, which model, how much it may do before it asks, and where it runs.
A person can read what will happen without opening anything, and change any of it without leaving the composer.

Each chip with a `commandId` is one command's argument, asked through the palette, so nothing here knows what a model or a permission mode is and a new chip is a new command rather than a change to this file.
A chip with no `commandId` is shown and not asked: a value fixed for the session is still worth reading, and a panel offering one choice is a worse way of saying so.

`where` puts an option on a second row, under what runs it.
One line held all of them until a host that answers every question about where put eight chips on it and the row truncated each to its mark; a host that asks nothing about where keeps one line.
`composerRows` answers 1 or 2 before the bar is drawn, which is what the composer needs to know how much of a short terminal the menu above it can have.

The bar orders the chips what-then-where rather than in the order they mounted, because tab order is registration order and the host's answers arrive a round trip after the first frame.
The send chip carries `SEND_ID`, says queue rather than send while `running`, is disabled by `sendDisabled`, and shows `queued` when there is a queue.
Escape on any chip is `onLeave`, which is back to the field and not out of the screen.

## See also

- [ChatComposer](chat-composer.md) - the bar under the field
- [openPicker](chat-helpers.md) - what a chip opens
- [settingIcon](setting-icons.md) - the mark in front of a label
