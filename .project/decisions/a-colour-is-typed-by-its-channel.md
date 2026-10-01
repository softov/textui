---
title: A colour token is typed by the channel it is used in
status: accepted
date: 2026-09-30
refs:
  - "[code://packages/core/src/types/style.ts#L9-L23](../../packages/core/src/types/style.ts#L9-L23) - `ColorToken` and `StyleColor`, one list for every channel"
  - "[code://packages/core/src/types/style.ts#L200-L201](../../packages/core/src/types/style.ts#L200-L201) - `fg` and `bg`, both `StyleColor`"
  - "[code://packages/core/src/types/style.ts#L90-L93](../../packages/core/src/types/style.ts#L90-L93) - the four border sides, the same union again"
  - "[code://packages/widgets/src/data/list.ts#L213-L214](../../packages/widgets/src/data/list.ts#L213-L214) - a row that states the background and the text as two tokens, which nothing checks"
---

## Context

`fg`, `bg`, `border` and `divider` all take `StyleColor`, which is every token or a literal colour. So `fg: 'canvas'`, `bg: 'onSelected'` and `border: 'text'` compile, and each of them is a mistake that only shows up when somebody looks at the frame. The channel a token belongs to lives in the token's name and in the writer's memory, not in the type.

Softov, 2026-09-30: "like using active to color and bg at same time, or for a border. naming are mostly wrong."

## Decision

A colour is typed by the channel it is used in. `fg` takes foreground tokens, `bg` takes background tokens, `border` and `divider` take border tokens, and each union still accepts a literal colour. A token used in the wrong channel is a compile error rather than a rendering somebody has to notice.

## Consequences

- Every token gains an owner: the channels it may appear in, stated once in the types.
- A component's props say which channel they accept, so a caller cannot pass the wrong one either.
- Token names stop carrying the channel as a prefix or suffix, because the type carries it: `selected` as a background and `onSelected` as a foreground become a background token and a foreground token.
- Migrating means touching every `fg`, `bg` and `border` that passes a token, which is most components, so it lands with the state rework rather than before it.

## Options

- **One union, enforced by naming and review**: no code change, and the mistake stays possible.
- **Runtime validation**: a wrong channel warns in the frame, which is later than a compile error and noisier.
- **Separate palettes per channel**, so `bg` and `fg` do not even share a token namespace: strictest, and then a paired colour like `selected` and `onSelected` cannot be found from one another.
