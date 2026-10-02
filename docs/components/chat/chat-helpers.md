---
title: Chat helpers
parent: Chat
grand_parent: Components
nav_order: 4
---

# Chat helpers

The functions the chat components are built out of, from `@textui/chat`.

<!-- docs:setup
declare const app: import('@textui/core').TextUIApp; -->

## `openPicker`

```tsx
import { openPicker } from '@textui/chat';

openPicker(app, { commandId: 'chat.model', anchorId: 'chat.option.model' });
```

A chip on the composer's control row asks one question - which harness, which model, how much it may do without asking, which workspace - and every one of those is a command with an argument.

The command palette already knows how to ask about exactly that: `openAt` drills straight into an argument, `choices` may be a list, a function or a promise, an argument without choices is answered by typing, and `preview` shows what a highlighted value would do.
So this is not a second overlay.
It is the same one, anchored above the control that asked and shown one command's question rather than the whole registry, and anything registered later is a command with an argument and needs nothing here.

It is a toggle: a control whose panel is already showing closes it, because clicking it again to make it go away is the first thing anybody tries.
It closes the previous panel before opening the next, so a second chip replaces the first rather than stacking two with the same id.
The layer is floating rather than modal - there is no scrim, because the row it is asking about has to stay readable underneath it - and it traps focus, dismisses on escape and on an outside click, and is anchored above the chip, aligned to its left edge.
However it was closed, focus goes back to the chip that asked, because a dismissal would otherwise leave the keyboard on a node that is no longer mounted.

A command with nothing to ask is run instead of opened.

`PickerOptions` is `commandId` and `anchorId`, then `width` for a fixed panel, `maxWidth` (52 by default), `visibleRows` (6 by default), and `descriptions` as `inline` or `below`.
Left off, the panel is as wide as its widest answer, which is what a chip wants, since "Worktree" and "Step-by-step collaboration" are the same question asked at two very different widths.
`PICKER` is the layer id it uses.

## `useReportMeasure`

```tsx
import { useReportMeasure } from '@textui/chat';

function Where({ onMeasure }: { onMeasure: (rect: import('@textui/core').Rect | null) => void }) {
  useReportMeasure(onMeasure);
  return <box />;
}
```

It tells whoever asked where this component is, on every change, and `null` on the way out - because a screen that had one would otherwise keep making room for it after it had gone.

The report is a `useMeasure` rect, so it is the box the component was given rather than the room inside its border.
The callback is read through a ref, so an inline arrow - which is a new function every render - does not re-run the unmount report every frame.

## The composer's ids

```tsx
import { chipId, composerRows, SEND_ID } from '@textui/chat';
import type { ComposerOption } from '@textui/chat';

const options: ComposerOption[] = [
  { id: 'model', label: 'claude', commandId: 'chat.model' },
  { id: 'workspace', label: '/srv/api', where: true },
];

const rows = composerRows(options);
const model = chipId('model');
const send = SEND_ID;
```

`composerRows(options)` is how many rows the bar takes for these options: two when any of them is a `where`, one otherwise.
The composer needs that number before the bar is drawn, to know how much of a short terminal is left for the menu above it.

`chipId(id)` is the focus id of one chip, and it has to be knowable because the picker anchors to it.
`SEND_ID` is the focus id of the send chip, which is the one verb on the bar.

## See also

- [ComposerBar](composer-bar.md) - the chips this opens panels for
- [CommandPalette](../navigation/command-palette.md) - the overlay it reuses
- [Layers](../../platform/layers.md) - what a floating layer is
