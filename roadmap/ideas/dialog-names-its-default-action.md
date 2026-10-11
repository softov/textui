# A dialog names its default action

Proposed 2026-10-11, from ahpc's changes screen (its plan screen/11).

`Dialog` focuses its first action, and the first action is the default: [dialog.ts:7-8](../../packages/widgets/src/overlay/dialog.ts#L7-L8) says so and [dialog.ts:60](../../packages/widgets/src/overlay/dialog.ts#L60) sets `autoFocus: i === 0`. The order of the buttons and the default are then one choice.

ahpc meets this when a person stages, unstages, discards or commits. It asks [All files, This file, Cancel], with "This file" as the default. With `Dialog` as it is, ahpc draws [This file, All files, Cancel] so that "This file" is first.

## Proposal

An action takes `default?: boolean`. The action marked `default` gets the focus when the dialog opens. With no action marked, the first one gets it, as today.

More than one marked is the first of them.

## Where

- `packages/widgets/src/overlay/dialog.ts`, the `actions` type and the `autoFocus` line.
- A test with three actions and the second one marked.
- ahpc moves to the release that has it and puts its buttons back in the order [All files, This file, Cancel].
