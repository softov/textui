---
title: The built-in themes carry the state colours
status: done
depends:
  - task-01-the-state-reaches-the-theme.md
layer: "widgets, chat, core themes"
refs:
  - "[code://packages/widgets/src/data/list.ts#L213-L214](../../../../packages/widgets/src/data/list.ts#L213-L214) - the list row, the pattern the other eight copy"
  - "[code://packages/widgets/src/data/tree.ts](../../../../packages/widgets/src/data/tree.ts) - the tree row"
  - "[code://packages/widgets/src/data/index.ts](../../../../packages/widgets/src/data/index.ts) - the table row"
  - "[code://packages/widgets/src/control/text-area.ts](../../../../packages/widgets/src/control/text-area.ts) - the field's own selection"
  - "[code://packages/widgets/src/data/code-viewer.ts](../../../../packages/widgets/src/data/code-viewer.ts) - the marked and caret lines"
  - "[code://packages/widgets/src/navigation/menu.ts](../../../../packages/widgets/src/navigation/menu.ts) - the menu row"
  - "[code://packages/widgets/src/navigation/tabs.ts](../../../../packages/widgets/src/navigation/tabs.ts) - the solid tab"
  - "[code://packages/chat/src/bubble.tsx](../../../../packages/chat/src/bubble.tsx) and [code://packages/chat/src/toolcall.tsx](../../../../packages/chat/src/toolcall.tsx) - the header row of a block and of a call"
  - "[code://packages/core/src/themes/builtin.ts](../../../../packages/core/src/themes/builtin.ts) - where the defaults move to, per theme"
---

## Objective

Every component that fills a state reads that fill from the theme, so a theme can move one component's state colour and leave its neighbours alone, and a theme that states nothing sees exactly what it sees today.

## Files

- `UPDATE: packages/core/src/themes/builtin.ts` - each built-in theme gains `components` entries for the components it wants to differ, referencing the tokens it already uses.
- `UPDATE: packages/widgets/src/data/list.ts`, `data/tree.ts`, `data/index.ts`, `control/text-area.ts`, `data/code-viewer.ts`, `navigation/menu.ts`, `navigation/tabs.ts` - the state background and its paired foreground move out of the node and into the theme's entry for that component.
- `UPDATE: packages/chat/src/bubble.tsx`, `toolcall.tsx`, `controls.tsx` - the same for the two selected headers and the control row.
- `UPDATE: packages/testing/test/list-selection.test.ts` - keep the pairing assertions, now that the pair comes from the theme.
- `CREATE: packages/testing/test/state-override.test.ts` - one theme override moves one component.

## Steps

1. For each component, name the states it actually has: a list row has `selected`, `active` and `disabled`; the code viewer has `active` and `focus`; the rest follow `StatefulStyle`.
2. Move each state's `bg` and its paired `fg` into the built-in themes' `components` entry, keeping the token names so the palette still moves them together.
3. Remove the state colours from the components, and leave the non-state work where it is: truncation, the marker, the description giving ground.
4. Keep the tokens `selected`, `active`, `hover` and the `on*` pair as what the built-in defaults reference, so a theme that states nothing and a theme that changes the token both behave as they do today.
5. Extend the harness test: a theme that overrides `components.List.selected` moves the list row and leaves the table row unchanged.

## Validation

- `packages/testing/test/state-override.test.ts`: one component's override is drawn on that component and on no other.
- `packages/testing/test/list-selection.test.ts`: a filled row still carries the colour written on it, from the theme.
- `pnpm -r test` green, and the playground test at 40 columns.

## Resume

