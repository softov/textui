---
title: A colour is typed by its channel
status: todo
depends:
  - task-01-the-state-reaches-the-theme.md
layer: "core types, every component"
refs:
  - "[code://packages/core/src/types/style.ts#L9-L23](../../../../packages/core/src/types/style.ts#L9-L23) - `ColorToken` and `StyleColor`, one list for every channel"
  - "[code://packages/core/src/types/style.ts#L200-L201](../../../../packages/core/src/types/style.ts#L200-L201) - `fg` and `bg`"
  - "[code://packages/core/src/types/style.ts#L90-L93](../../../../packages/core/src/types/style.ts#L90-L93) - the four border sides"
  - "[code://packages/core/src/runtime/style.ts#L112-L120](../../../../packages/core/src/runtime/style.ts#L112-L120) - `resolveColor`, which turns either a token or a literal into a cell colour"
---

## Objective

`fg` takes foreground tokens, `bg` takes background tokens, and `border` and `divider` take border tokens, each still accepting a literal colour, so a token used in the wrong channel does not compile.

## Files

- `UPDATE: packages/core/src/types/style.ts` - split `ColorToken` into `FgColor`, `BgColor` and `BorderColor`, keep `StyleColor` for the literal escape, and narrow `Style.fg`, `Style.bg`, the border sides and `divider`.
- `UPDATE: packages/core/src/runtime/style.ts` - `resolveColor` and `styleFromProps` follow the narrowed fields.
- `UPDATE: packages/widgets/src/**`, `packages/chat/src/**` - every place that passes a token, which is most of them, and every place that interpolates one into a `Style`.
- `CREATE: packages/core/test/colour-channel.test.ts` - the compile-time cases.

## Steps

1. Give each token an owner by listing the channels it may appear in, one list per channel, with the literal colour as the shared escape.
2. Narrow `Style`'s fields to the matching union, and let the type error find the call sites.
3. Name the state pair by channel: `selected` and its text stop sharing a suffix convention, because the type now says which is which.
4. Write the negative cases as `@ts-expect-error`: `fg: 'canvas'`, `bg: 'onSelected'`, `border: 'text'`.

## Validation

- `packages/core/test/colour-channel.test.ts`: the `@ts-expect-error` cases, plus the literal-colour cases that must still compile.
- `pnpm -r typecheck` green, which is the real test: every wrong-channel use is a call site to fix.
- `pnpm -r test` green.

## Resume

