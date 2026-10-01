---
title: A component's state colours belong to the component, not to a global token
status: accepted
date: 2026-09-30
refs:
  - "[code://packages/core/src/types/style.ts#L219-L226](../../packages/core/src/types/style.ts#L219-L226) - `StatefulStyle`, which already names base, focus, hover, active, selected and disabled"
  - "[code://packages/core/src/runtime/style.ts#L90-L108](../../packages/core/src/runtime/style.ts#L90-L108) - `resolveStyle`, whose variants come from `variant`, `tone` and `size` only"
  - "[code://packages/core/src/runtime/style.ts#L60-L78](../../packages/core/src/runtime/style.ts#L60-L78) - `flattenStyleInput`, which already states the precedence between the states"
  - "[code://packages/core/src/themes/registry.ts#L250-L258](../../packages/core/src/themes/registry.ts#L250-L258) - `styleFor(component, variants)`, the per-component map a theme already fills"
  - "[code://packages/core/src/themes/builtin.ts#L126-L135](../../packages/core/src/themes/builtin.ts#L126-L135) - the console theme's note that `selected` carries `inverted` text and `active` carries `text`"
  - "[code://packages/widgets/src/data/list.ts#L213-L214](../../packages/widgets/src/data/list.ts#L213-L214) - the row that picks `selected` or `active` as its background and `onSelected` or `onActive` as its text"
---

## Context

The palette names states, and every component decides for itself what they mean. `selected` is a row background in a list, a tab fill and a text-area selection, while `active` is a different component's idea of the same thing, a marked line in the code viewer and, in `InteractionState`, the pressed state. Nothing stops a state token being used as a border or as text, because one union serves every channel.

The runtime already holds most of a better model. `StatefulStyle` names six states, `resolveStyle` receives the live `InteractionState`, and a theme already has a per-component map through `styleFor`. The gap is that variants are built from `variant`, `tone` and `size` only, so `components.List.selected` is expressible and read by nothing, and every component therefore hardcodes the state colour it wants.

Softov, 2026-09-30: "component themes should have its colors on the component definition. Components.List.selected.bg etc., because active and selected could mean anything. change one color in one place, changes on all."

## Decision

A state is styled where the component is. A theme states `components.List.selected = { bg, fg }`, and the list row wears it. The global tokens stay as the defaults the built-in themes reference, so a palette change still moves everything that has not been overridden, and a component can now be changed alone.

## Consequences

- A theme can restyle one component's selected row without moving every selection in the library.
- `styleFor` has to receive the interaction state, which makes the six names in `StatefulStyle` the shared vocabulary of states.
- Every component that fills a state has to stop stating it as a plain prop, or the node's prop outranks the theme and the theme's value is silently ignored.
- Component and state names become public API, so docs and the playground have to name them, and a missing name has to fail visibly.
- The state tokens lose their monopoly, and `active` has to stop carrying two meanings.

## Options

- **Flat namespaced tokens**, `list-selected-bg`: needs no runtime change, but the token list grows by component times state times channel, and it is a second vocabulary beside `components` that a theme has to learn.
- **Keep the global state tokens and only rename them**: the smallest change, and the one that leaves a component unable to differ from the library without a new token.
- **Per-instance styles at the call site**, which is what `style={{ hover: { bg: 'hover' } }}` already does: right for a caller, useless to a theme, because a theme is not at the call site.
