---
title: `active` stays a palette token, and stops being a state a component names
status: accepted
date: 2026-10-01
refs:
  - "[code://packages/core/src/themes/builtin.ts](../../packages/core/src/themes/builtin.ts) - `SELECTION_UNFOCUSED`, which names `active` as the dim end of the selection pair"
  - "[code://packages/core/src/themes/registry.ts](../../packages/core/src/themes/registry.ts) - `onActive`, still derived from the theme's `text`"
  - "[code://packages/core/src/types/style.ts](../../packages/core/src/types/style.ts) - the state names, where `active` is now only pressed"
---

## Context

[A component's state colours belong to the component](a-components-state-owns-its-colours.md) moves every state colour out of the components and into the built-in themes' `components` maps, which retires `active` as a name any component reaches for: the unfocused selection becomes `selected` and the pressed state keeps `active`.

That left a fork the plan had proposed an answer to and had not settled. The palette token `active` is the dim end of the selection pair - the fill a remembered selection takes - and the state name `active` is pressed. Two names, one meaning each, and the token would have been free to go once nothing but the built-in defaults named it.

Softov, 2026-09-30: "Leave the palette untouched."

## Decision

`active` and `onActive` stay in the palette. `active` is the dim end of the selection pair and `onActive` is what is written on it, exactly as before; what retires is the *component state* that shared the word. No component names `active` any more, and a theme that restates `active` restates every unfocused selection in the application - which is now the honest description of the token, rather than an accident of nine components picking the same word.

The pairing survives with it: `SELECTION_UNFOCUSED` in `builtin.ts` is `{ bg: 'active', fg: 'onActive' }`, so changing one of the two in a theme's `colors` still moves every remembered selection, which is what the token was for.

## Consequences

- The palette and the component states share a word without sharing a meaning, which is the thing that made the original naming unclear. It is now visible in two places rather than one: `StateName` is `selected | hover | active | focus | disabled` and the palette's `active` is a background, so a reader has to be in the right list to know which is meant.
- `onActive` stays derived from the theme's `text`, so a theme that restates one half of the selection pair cannot leave the other behind.
- Retiring the token is still available later, and it is a one-line change to `SELECTION_UNFOCUSED` and the `Colors` map. Nothing depends on the name.

## Options

- **Retire `active` and `onActive`**, naming the dim end of the selection pair something of its own. Cleanest vocabulary, and it breaks every theme that states either half - for no gain, since the built-in defaults are the only things naming them and they are free to name whatever they like.
- **Rename the state and keep both tokens**, which is what this decision is.
- **Keep `active` for the unfocused selection and rename the pressed state.** Rejected: `InteractionState.active` is already pressed in the types, and the pressed state is the one that has no other word.