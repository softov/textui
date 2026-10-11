# Tabs skip a disabled tab

Proposed 2026-10-11, from ahpc's changes screen (its plan screen/10).

`Tabs` picks a tab with left and right, and a click. When the next tab is disabled, the arrow does nothing: [tabs.ts:34-37](../../packages/widgets/src/navigation/tabs.ts#L34-L37) looks one step and stops. A tab past a disabled one can then be reached by a click only.

ahpc meets this on its changes screen. A host offers "Uncommitted Changes", "This Turn" and "Branch", and "This Turn" is disabled because the screen has no turn to give it. Right from "Uncommitted Changes" stops there, and "Branch" is out of reach from the keyboard.

## Proposal

Left and right step past every disabled tab to the next enabled one. When there is none in that direction, the key does nothing, as at the end of the row today.

Enter stays unbound. The arrows pick the tab, as a tab row does when the tab it shows costs nothing to switch to.

## Where

- `packages/widgets/src/navigation/tabs.ts`, the `useInput` handler.
- A test with a disabled tab in the middle of three.
- ahpc moves to the release that has it; its test "a disabled tab does not move the scope" then also checks that right reaches the tab past it.
