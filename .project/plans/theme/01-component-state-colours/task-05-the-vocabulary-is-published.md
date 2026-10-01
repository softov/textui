---
title: The vocabulary is published
status: done
depends:
  - task-02-the-built-in-themes-carry-the-state-colours.md
  - task-03-a-colour-is-typed-by-its-channel.md
  - task-04-active-stops-meaning-two-things.md
layer: "docs, playground"
refs:
  - "[code://docs/themes/tokens.md](../../../../docs/themes/tokens.md) - the token page a theme author reads"
  - "[code://docs/decisions.md](../../../../docs/decisions.md) - the published decisions page"
  - "[code://CHANGELOG.md](../../../../CHANGELOG.md) - the release notes and the migration"
  - "[code://playground/src/registry.ts](../../../../playground/src/registry.ts) - every playground, which is what the playground test mounts"
  - "[code://playground/test/playgrounds.test.tsx](../../../../playground/test/playgrounds.test.tsx) - the mount, resize and capability-strip test"
---

## Objective

A theme author can find the component and state names, the channels and what each token may be used for, and an application upgrading to the release knows what changed.

## Files

- `UPDATE: docs/themes/tokens.md` - the channels, the state names, and the `components.<Component>.<state>` shape with a worked example.
- `UPDATE: docs/decisions.md` - both decisions in that page's own Chosen and Cost form.
- `UPDATE: CHANGELOG.md` - the state rework as one breaking entry with what replaced what.
- `UPDATE: playground/src/registry.ts` and `playground/test/playgrounds.test.tsx` - a playground that mounts each component in each state, so the names are exercised and a missing one is visible.

## Steps

1. Write the state table once in `tokens.md`: component, the states it has, and the tokens the built-in themes use as defaults.
2. Add the two decisions to `docs/decisions.md` with the cost each carries, since that page is what a consumer reads before upgrading.
3. Add the CHANGELOG entry with the before and after of a theme that states one component.
4. Add the state playground and register it, so `playgrounds.test.tsx` mounts every state at 40 columns and with no capabilities.

## Validation

- `node scripts/check-docs.mjs` reports no errors.
- `npx vitest run playground/test/playgrounds.test.tsx` green, with the state playground in it.
- `pnpm -r test` and `pnpm typecheck` green.

## Resume

