---
title: Implemented
plan: ../plan.md
---

# What exists now

## The states reach the theme

`resolveStyle` ([`code://packages/core/src/runtime/style.ts`](../../../../packages/core/src/runtime/style.ts)) pushes the true names of `InteractionState` onto `variants` after `variant`, `tone` and `size`, in the order `flattenStyleInput` already states: `selected`, `hover`, `active`, `focus`, `disabled`. The names come from `stateVariants(state)`, which is exported and is also what a component asks the theme with when it needs a style for itself rather than for a node - the text area's selection and the editor's selection paint both use it.

The list was in `runtime/style.ts` as a private `STATE_ORDER` and `STATE_VARIANT` rather than in `types/`, because `types/` imports no runtime value.

A state is also offered qualified by each of the props-driven names on the same node, immediately after the flat one: `Tabs.solid.selected` for a solid tab and `Tabs.solid.hover` beside it. This is what lets one entry mean the pair of variants and the other single out one. The qualified name merges last, and the order between the states is unchanged, so `disabled` still wins over everything.

## The built-in themes carry the colours

`STATE_STYLES` in [`code://packages/core/src/themes/builtin.ts`](../../../../packages/core/src/themes/builtin.ts) is the shared entry list, spread into `DARK` and `LIGHT`. `MONO` has none, deliberately: with `colorDepth: 0` the resolve blanks every colour anyway, and stating them would be a lie the theme does not act on. `CONSOLE` keeps its own note about `active` and adds one line saying it is the dim end of the pair rather than a pressed control.

Every component that drew a state colour at the node now states the state instead, and nothing else:

| Component | `styleAs` | States |
| --- | --- | --- |
| list row | `List` | `selected`, `focus` |
| tree row | `Tree` | `selected`, `focus` |
| table row | `Table` | `selected`, `focus` |
| text field selection | `TextArea` | `selected`, `focus` |
| code viewer row | `CodeViewer` | `selected`, `focus` |
| menu row | `Menu` | `selected`, `focus` |
| tab | `Tabs` | `selected`, and `solid.selected` for the fill |
| tool call header | `ToolCallRow` | `selected` |
| reasoning header | `ReasoningBlock` | `selected` |
| composer chip | `ComposerChip` | `focus` |
| editor selection | `Editor` | `selected`, background only |

The last one is the tenth component the reconnaissance missed: `packages/documents` was not in the search's glob. It paints its selection with `theme.styleFor(EDITOR, ['selected'])` and the entry states `{ bg: 'active' }` alone, so the pixels do not change and the syntax colours still show through.

## `focused` is a prop

A row's `InteractionState.focused` was structurally always false - the keyboard belongs to the list, and `stateOf` compared the focus id against the row's own. `focused` is now a tri-state node prop, honoured in `stateOf`: a boolean means what it says, and absent means what it always meant. List, tree, table and menu rows state `focused: active && focus.focused`; the composer chip gets it from the focus id it already carried.

## A colour is typed by its channel

`ColorToken` is the union of `FgColorToken`, `BgColorToken` and `BorderColorToken`, and `fg`, `bg`, the four border sides, `BorderSpec.color` and `scrim` take their own. `StyleColor` is the whole union plus a literal and is what the resolver takes, so a literal still works anywhere.

`cursor` is in two lists on purpose: an underline caret is a foreground and a block caret is the foreground swapped. The border list keeps `muted` and `subtle` and refuses only the loud end of the foreground list, so a dim frame is still a line somebody can draw.

## What was verified

- `npx vitest run` at the repository root - 127 files, 2196 tests, green.
- `npx vitest run playground/test` - 4 files, 214 tests, green, including the new `state` playground at 40 columns with capabilities stripped.
- Every package's `tsconfig.test.json` typechecks clean, which is what `pnpm -r typecheck` runs. Three `packages/chat/test/composer.test.tsx` errors and one in `packages/documents/test/state-colours.test.ts` were found here and fixed rather than deferred.
- `node scripts/check-docs.mjs` - 0 errors, 97 pre-existing warnings.

New tests:

| File | What it holds |
| --- | --- |
| `packages/core/test/colour-channel.test.ts` | Nine `@ts-expect-error` cases, one per channel, plus the literal escape on each |
| `packages/testing/test/state-style.test.ts` | A theme's `components` entry reaches a node in both states, loses to an explicit prop, is qualified by a variant, and reaches only the component that names it |
| `packages/testing/test/state-override.test.ts` | One override moves one component; every built-in name is mounted and read as a cell; the live/remembered pair stays distinguishable in dark and light at 24 and 8 colours |
| `packages/testing/test/list-selection.test.ts` | Rewritten to read the drawn cell rather than the node prop, which is where the answer is now |
| `packages/chat/test/state-colours.test.ts` | `ToolCallRow`, `ReasoningBlock`, `ComposerChip` - the names `packages/testing` cannot mount |
| `packages/documents/test/state-colours.test.ts` | `Editor` |

The rule those last three follow: a `components` entry nothing reads is a theme author's edit that appears to work. Each mounts the real component, puts it in the state, and reads the cell, so a name that stopped being stated anywhere shows up as a row on the canvas.

## Where it departed from the plan

- **`active` and `onActive` were not retired.** The plan proposed it; Softov answered "Leave the palette untouched". Recorded as [active-stays-a-palette-token](../../../decisions/active-stays-a-palette-token.md), and a row added to *Decisions locked in*.
- **The unfocused selection is `selected` and the focus is `focus`**, not a new name for the unfocused case. It answers the user's question about a menu with one item active but not focused - that menu takes `Menu.selected`, the dim fill, exactly as a list does - without a fifth word for what is the same thing everywhere else.
- **`Tabs` is the stated exception.** A tab is *open*, not selected, so it has `selected` and no second state: dimming it when the strip loses the keyboard would claim no document is open.
- **`Editor` was a tenth component**, missed by the reconnaissance's glob.
- **A state qualified by a variant was not in the plan at all.** It came out of Tabs needing one, and it is the general primitive rather than a special case.
- **The tests read cells rather than props.** The plan said "keep the pairing assertions"; keeping them literally would have asserted that the node states a colour, which is the thing that stopped being true.