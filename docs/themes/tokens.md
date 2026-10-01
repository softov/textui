---
title: Tokens
parent: Themes
nav_order: 1
---

# Tokens

A component names a role, never a colour:

```
canvas surface surfaceAlt overlay
border borderStrong borderSubtle
text muted subtle inverted
accent primary secondary
success warning danger info
onDefault onPrimary onSecondary onAccent
onSuccess onWarning onDanger onInfo onMuted
onSelected onActive
hover active selected focus disabled
scrim cursor shadow
```

Literal colours still work - `fg="#ff8800"`, `fg="red"`, `fg={{ rgb: [255, 136, 0] }}` - but a token is what survives a theme change.

## Tones come in pairs

Every tone has an `on*` token saying what to write *on* it once it is the background - one for each of the nine in `SemanticVariant`, including `onDefault`, `onSecondary` and `onMuted`.

There is one per tone rather than a single `inverted` for all of them, because the contrast that works on green is not the one that works on red - and getting it wrong makes a label unreadable exactly when it matters, which is when the control is selected. `TONE` and `ON_TONE` in `packages/core/src/ui/tone.ts` state the pairing once, and are the list to check this page against.

`inverted` still exists and is still used, for the places that invert against the page rather than against a tone.

The two selection backgrounds are a pair of their own: `selected` carries `onSelected` and `active` carries `onActive`. Both are *derived* - `onSelected` from the theme's `inverted` and `onActive` from its `text` - unless the theme states them, so a theme that restates one half of the pair cannot leave the other behind, and a component never has to know which theme it is under. `paper` states `onActive`, because its `text` is the terminal's own and a fill cannot be written on with a colour the user may have set to that fill.

## The shell owns the page

A shell paints `canvas` and `text` across the terminal, which is what makes a theme a theme rather than a set of accent colours: without it a light theme is dark-theme ink on whatever background the terminal already had, and only the dialogs - which paint their own `overlay` - look light.

This is why `createApp({ root })` mounts that node into `main` rather than replacing the shell with it.

## Colour is inherited

A node with no `fg` takes its parent's; the same for `bg`, and attributes accumulate, so `bold` on a row is bold for what is in the row. A box's own always wins.

This is load-bearing rather than a convenience. A terminal cell holds exactly one foreground and one background, so a `text` that did not inherit would be drawn in the terminal's default colours *and* punch a hole through the fill behind it - which is a label in the wrong colour on a button and a ragged bar of default background across the middle of it.

The corollary, for anyone writing a component: a fixed `fg="muted"` inside a row that can be selected is a bug - `muted` on a selected background is the one pairing that never reads. A row that fills must also say what is written on the fill: `bg="selected"` with `fg="onSelected"`, and `bg="active"` with `fg="onActive"`. Leaving the foreground to be inherited is what handed it the terminal's own, which a person may have set to the fill's colour.
