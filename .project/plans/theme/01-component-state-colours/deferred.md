---
title: Deferred
plan: ../plan.md
---

# What was set aside

## `components.Panel` and `components.Button` are still dead keys

Every built-in theme states `components: { Panel: { base: ... }, Button: { base: ... } }`, and neither is read. `Panel` and `Button` are function components, so they contribute no box of their own - `styleFor` is only reached for `kind === 'host'` instances - and the entries have been doing nothing since they were written. `styleAs` is the fix and it is already here: a panel would state `styleAs: 'Panel'` on the box it draws.

It is set aside because wiring it changes pixels, and not in a way this plan's tests can absorb. `PAPER.Panel.base` is `{ border: 'none', padding: [1, 2] }`, so making that key live would put two cells of padding inside every paper panel that currently has none. That is a visual change to four built-in themes on a plan about state colours, and it belongs to whoever is changing those panels.

**Where it goes.** Its own task, against `packages/widgets/src/ui/panel.tsx` and the button, with the padding change named in the changelog rather than discovered.

**What to watch for meanwhile.** A theme author who reads the built-in themes will find `Panel` and `Button` listed beside names that work, and reasonably conclude theirs works too. [`code://docs/themes/tokens.md`](../../../../docs/themes/tokens.md) says which two are not reachable yet, in the section that explains `styleAs`.

## The `LIGHT.active` hue

Resolved after this plan ran: the value is `#a5bdd8`, within the accent family, and `packages/testing/test/colour.test.ts` passes. Kept as a line here because the value changed after the first task, so the numbers first recorded in [implemented.md](implemented.md) were read against a red suite.