---
title: The state reaches the theme
status: done
depends: []
layer: "core runtime"
refs:
  - "[code://packages/core/src/runtime/style.ts#L90-L108](../../../../packages/core/src/runtime/style.ts#L90-L108) - `resolveStyle`, where the variant list is built"
  - "[code://packages/core/src/runtime/style.ts#L60-L78](../../../../packages/core/src/runtime/style.ts#L60-L78) - `flattenStyleInput`, whose order the state list has to match"
  - "[code://packages/core/src/types/style.ts#L219-L226](../../../../packages/core/src/types/style.ts#L219-L226) - `StatefulStyle`, the six state names"
  - "[code://packages/core/src/themes/registry.ts#L250-L258](../../../../packages/core/src/themes/registry.ts#L250-L258) - `styleFor`, which already merges one entry per name"
  - "[code://packages/testing/test/list-selection.test.ts](../../../../packages/testing/test/list-selection.test.ts) - the harness test this one sits beside"
---

## Objective

A theme that states `components.List.selected` is drawn on a selected row, and a theme that states nothing draws what it draws today.

## Files

- `UPDATE: packages/core/src/runtime/style.ts:97-100` - push the true names of `InteractionState` onto `variants`, after `variant`, `tone` and `size`, in the order `flattenStyleInput` states.
- `UPDATE: packages/core/src/types/theme.ts` - say in `styleFor`'s doc that the names are the component's variants and its states.
- `CREATE: packages/testing/test/state-style.test.ts` - the harness cases.

## Steps

1. Build the state list from `state` in the fixed order `selected`, `hover`, `active`, `focus`, `disabled`, which is the order `flattenStyleInput` already gives, so the two cannot disagree.
2. Push those names after the props-driven ones, so a state entry wins over `variant` and `tone`.
3. Keep the merge layers as they are: the theme first, then the component's defaults, then an explicit prop, then `props.style`.
4. Prove it at the harness: a theme registering `components: { Box: { selected: { bg: '#123456' } } }` and a node with `selected: true` is drawn with that background, and the same node under a theme that states nothing is unchanged.

## Validation

- `packages/testing/test/state-style.test.ts`: a stated state colour is drawn; a stated state colour loses to an explicit prop; an unstated one changes nothing.
- `npx vitest run packages/testing/test/state-style.test.ts` and `pnpm -r test` green.

## Resume

