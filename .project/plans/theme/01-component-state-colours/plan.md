---
title: A component's state colours are the theme's to state
domain: theme
status: built
built: 2026-10-01
priority: high
created: 2026-09-30
revalidated: 2026-09-30
requires: []
changes: []
creates: []
decisions:
  - decisions/a-components-state-owns-its-colours.md
  - decisions/a-colour-is-typed-by-its-channel.md
  - decisions/active-stays-a-palette-token.md
refs:
  - "[code://packages/core/src/runtime/style.ts#L90-L108](../../../../packages/core/src/runtime/style.ts#L90-L108) - `resolveStyle`, where the variant list is built and a state name would have to join it"
  - "[code://packages/core/src/runtime/style.ts#L60-L78](../../../../packages/core/src/runtime/style.ts#L60-L78) - `flattenStyleInput`, whose order already states the precedence between the states"
  - "[code://packages/core/src/types/style.ts#L219-L226](../../../../packages/core/src/types/style.ts#L219-L226) - `StatefulStyle`, the six names that become the shared vocabulary"
  - "[code://packages/core/src/types/style.ts#L9-L23](../../../../packages/core/src/types/style.ts#L9-L23) - `ColorToken` and `StyleColor`, which every channel shares today"
  - "[code://packages/core/src/types/style.ts#L200-L201](../../../../packages/core/src/types/style.ts#L200-L201) - `fg` and `bg`, the two fields a channel union would narrow"
  - "[code://packages/core/src/themes/registry.ts#L250-L258](../../../../packages/core/src/themes/registry.ts#L250-L258) - `styleFor(component, variants)`, which already merges a component's variants in order"
  - "[code://packages/core/src/themes/builtin.ts#L126-L135](../../../../packages/core/src/themes/builtin.ts#L126-L135) - the console theme's note that `selected` carries `inverted` text and `active` carries `text`"
  - "[code://packages/widgets/src/data/list.ts#L213-L214](../../../../packages/widgets/src/data/list.ts#L213-L214) - the row every other component copies: the state colour named at the node"
  - "[code://packages/chat/src/composer.tsx](../../../../packages/chat/src/composer.tsx) - the menu row, which states `selected`, `active` and `muted` itself"
  - "[code://packages/testing/test/list-selection.test.ts](../../../../packages/testing/test/list-selection.test.ts) - the harness test the contract extends"
  - "[code://docs/themes/tokens.md](../../../../docs/themes/tokens.md) - the page a theme author reads, which has to name the channels and the states"
  - "[code://docs/decisions.md](../../../../docs/decisions.md) - the published page the two decisions are summarised on when they land"
---

## Goal

A theme states a component's state colours where the component is, as `components.List.selected = { bg, fg }`, and the component wears them. The global tokens stop being the only place a state colour can live and become the defaults the built-in themes reference, so changing one still moves everything that has not been overridden, and changing a component moves only that component. A colour used in the wrong channel stops compiling.

## Reconnaissance

The files read and the patterns to reuse are the `refs` above, each with its note.

### Searches performed

- `rg "styleFor\(" packages/` - the only caller is `resolveStyle`; the registry's merge is in place and nothing else consults it.
- `rg "bg: 'selected'|bg: 'active'|fg: 'onSelected'|fg: 'onActive'" packages/*/src` - nine components state a state colour at the node: list, tree, table, text area, code viewer, menu, tabs, and the chat bubble, tool call and control rows.
- `rg "props.variant|props.tone|props.size" packages/core/src/runtime` - variants come from those three props only, so no state name ever reaches `styleFor`.
- `rg "selected|active" packages/core/src/types/style.ts packages/core/src/runtime/style.ts` - `StatefulStyle` and `InteractionState` both name `selected` and `active`, with `active` meaning pressed in the state and unfocused selection in the components.
- `rg "StyleColor" packages/core/src/types/style.ts` - `fg`, `bg`, the four border sides, and `divider` all take the same union.

### Runtime path

```
node props -> resolveStyle(props, theme, component, defaults, state)
  -> variants = variant, tone, size          (states missing here)
  -> theme.styleFor(component, variants)     (components.List.selected unread)
  -> defaults -> styleFromProps -> props.style[state]
  -> paint
```

### Gaps

- The interaction state is computed and passed to `resolveStyle`, and never becomes a variant, so a theme cannot state a component's state colours.
- Each component names its own state tokens, so its prop outranks whatever a theme states and a theme override would be silently ignored until the props go.
- One colour union serves every channel, so `fg: 'canvas'` and `border: 'onSelected'` compile.
- `active` is the pressed state in `InteractionState` and the unfocused selection in nine components.
- Not found: any published list of the component and state names a theme may set - searched `variant`, `components:`, `styleFor` in `docs/`.

## Decisions locked in

| # | Decision | Rationale / source |
| --- | --- | --- |
| 1 | [A component's state colours belong to the component](../../../decisions/a-components-state-owns-its-colours.md) | Softov, 2026-09-30: "component themes should have its colors on the component definition. Components.List.selected.bg etc." |
| 2 | [A colour is typed by the channel it is used in](../../../decisions/a-colour-is-typed-by-its-channel.md) | Softov, 2026-09-30: "like using active to color and bg at same time, or for a border" |

| What | Source | Task |
| --- | --- | --- |
| The interaction state joins the variant list, in the precedence `flattenStyleInput` already states | `(defaulted: selected, then hover, then active, then focus, then disabled)` | 01 |
| A theme's state style wins over the component's built-in default and loses to an explicitly passed prop | `(defaulted: the layer order already in resolveStyle)` | 01, 02 |
| The state colours leave the components and become entries in the built-in themes' `components` maps | `(defaulted: a theme's value cannot win while the node states its own)` | 02 |
| A channel union still accepts a literal colour | `(defaulted: a literal colour like #ff8800 is documented and used, so the union keeps it)` | 03 |
| `selected` and `active` stop being names a component reaches for once no component states them | `(defaulted: the palette keeps whatever the built-in defaults reference)` | 04 |
| The palette tokens `active` and `onActive` survive; what retires is the component state that shared the word | [active-stays-a-palette-token](../../../decisions/active-stays-a-palette-token.md) - Softov, 2026-09-30: "Leave the palette untouched" | 04 |
| The state that means an unfocused selection gets a name of its own, and `active` means pressed | `(defaulted: proposed - selected keeps the fill and gains a focused state beside it)` | 04 |

## Proposed architecture

- **Data flow** - `resolveStyle` builds `variants` from `variant`, `tone`, `size` and then the true names of `InteractionState`, in that specificity; `styleFor` merges `components.<Component>.base` and each named entry, and the component's own defaults sit above it.
- **State flow** - the app's `stateOf(instance)` already produces the six booleans; nothing new is stored.
- **Layer responsibilities** - `@textui/core`: the unions, the merge, the built-in defaults · `@textui/widgets` and `@textui/chat`: stop naming state colours, accept the theme's · `@textui/testing` and `playground`: prove one override moves one component.
- **Source-of-truth files** - [`code://packages/core/src/runtime/style.ts`](../../../../packages/core/src/runtime/style.ts), [`code://packages/core/src/types/style.ts`](../../../../packages/core/src/types/style.ts), [`code://packages/core/src/themes/builtin.ts`](../../../../packages/core/src/themes/builtin.ts)

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - The state reaches the theme](task-01-the-state-reaches-the-theme.md) | done | - |
| [02 - The built-in themes carry the state colours](task-02-the-built-in-themes-carry-the-state-colours.md) | done | 01 |
| [03 - A colour is typed by its channel](task-03-a-colour-is-typed-by-its-channel.md) | done | 01 |
| [04 - Active stops meaning two things](task-04-active-stops-meaning-two-things.md) | done | 02, 03 |
| [05 - The vocabulary is published](task-05-the-vocabulary-is-published.md) | done | 02, 03, 04 |

## Risks and tradeoffs

- This breaks every theme that states `components` or leans on the state tokens, so it lands in one release with a migration note in `CHANGELOG.md`, and it is why 0.8.0 is held rather than published now.
- Component and state names become public API, so a theme author needs them in `docs/themes/tokens.md`; a missing name has to render as a visible miss, which the playground test already checks.
- Reading the interaction state on every resolve costs a little per frame; the bench script is the check, and the merge is a map lookup per named state.
- `InteractionState.active` is the pressed state and must keep that meaning, so the unfocused selection needs a new name rather than a redefinition; task 04 cannot land before 02 and 03 remove the token's other uses.

## Resume state

- **Done so far:** all five tasks. See [implemented.md](implemented.md) for what exists and [deferred.md](deferred.md) for the one thing set aside.
- **Next action:** none. The plan is built; 0.8.0 is not published.

## Final verification checklist

- [x] `components.<Component>.<state>` reaches a node, with a test that fails when the state is not pushed.
- [x] No component states a state colour as a plain prop any more, and a theme override moves one component and not its neighbours.
- [x] A token used in the wrong channel is a compile error, with a `@ts-expect-error` case per channel.
- [x] `active` has one meaning, and no component names it.
- [x] `docs/themes/tokens.md`, `docs/decisions.md` and `CHANGELOG.md` carry the vocabulary and the migration.
- [x] `npx vitest run` and every package's `tsconfig.test.json` green, which is what `pnpm -r test` and `pnpm typecheck` run.
- [x] `plans/index.md` updated.

Checked green: `npx vitest run` is 127 files and 2196 tests, `npx vitest run playground/test` is 4 files and 214, and `node scripts/check-docs.mjs` reports 0 errors.
