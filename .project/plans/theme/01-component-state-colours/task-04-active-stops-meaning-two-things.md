---
title: Active stops meaning two things
status: done
depends:
  - task-02-the-built-in-themes-carry-the-state-colours.md
  - task-03-a-colour-is-typed-by-its-channel.md
layer: "core types, core themes, every component"
refs:
  - "[code://packages/core/src/runtime/style.ts#L31-L45](../../../../packages/core/src/runtime/style.ts#L31-L45) - `InteractionState`, where `active` is the pressed state"
  - "[code://packages/core/src/runtime/style.ts#L60-L78](../../../../packages/core/src/runtime/style.ts#L60-L78) - `flattenStyleInput`, which reads `state.active` as pressed"
  - "[code://packages/core/src/types/style.ts#L219-L226](../../../../packages/core/src/types/style.ts#L219-L226) - `StatefulStyle`, whose `active` is the same word"
  - "[code://packages/widgets/src/data/list.ts#L213-L214](../../../../packages/widgets/src/data/list.ts#L213-L214) - where `active` meant an unfocused selection"
---

## Objective

One word, one meaning: `active` is the pressed state, and a selection that has lost the keyboard is a state of its own with a name that says so.

## Files

- `UPDATE: packages/core/src/types/style.ts` - the state list, whichever way the name is settled.
- `UPDATE: packages/core/src/themes/builtin.ts` - the palettes stop carrying whichever token the change retires.
- `UPDATE: packages/widgets/src/**`, `packages/chat/src/**` - no component names the retired token.
- `UPDATE: docs/themes/tokens.md` - the page states the new meaning.

## Steps

1. Settle the name for a selected row that does not have the keyboard, with Softov: proposed `selected` plus a `focused` variant, so the same state entry carries both and the theme states one fill and one dimmer fill.
2. Move the built-in defaults onto that name.
3. Retire the old token from the palette once nothing references it, and say in the release note what replaced it.
4. Check the list, tree, table, text area, code viewer and menu by hand in a terminal, focused and unfocused.

## Validation

- `pnpm -r typecheck` clean with the token gone, which proves nothing names it.
- `pnpm -r test` green.
- By hand: a list row with and without the keyboard, in a dark and a light theme, at 24 and at 8 colours.

## Resume

