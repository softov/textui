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
onAccent onPrimary onSuccess onWarning onDanger onInfo
hover active selected focus disabled
scrim cursor shadow
```

Literal colours still work - `fg="#ff8800"`, `fg="red"`, `fg={{ rgb: [255, 136, 0] }}`
- but a token is what survives a theme change.

## Tones come in pairs

`onAccent`, `onPrimary`, `onSuccess`, `onWarning`, `onDanger` and `onInfo` are
what to write *on* a tone once it is the background. There is one per tone
rather than a single `inverted` for all of them, because the contrast that works
on green is not the one that works on red - and getting it wrong makes a label
unreadable exactly when it matters, which is when the control is selected.
`TONE` and `ON_TONE` in the catalog state the pairing once.

## The shell owns the page

A shell paints `canvas` and `text` across the terminal, which is what makes a
theme a theme rather than a set of accent colours: without it a light theme is
dark-theme ink on whatever background the terminal already had, and only the
dialogs - which paint their own `overlay` - look light.

This is why `createApp({ root })` mounts that node into `main` rather than
replacing the shell with it.

## Colour is inherited

A node with no `fg` takes its parent's; the same for `bg`, and attributes
accumulate, so `bold` on a row is bold for what is in the row. A box's own
always wins.

This is load-bearing rather than a convenience. A terminal cell holds exactly
one foreground and one background, so a `text` that did not inherit would be
drawn in the terminal's default colours *and* punch a hole through the fill
behind it - which is a label in the wrong colour on a button and a ragged bar of
default background across the middle of it.

The corollary, for anyone writing a component: a fixed `fg="muted"` inside a row
that can be selected is a bug. Pass `undefined` when the row is selected and let
it inherit, because `muted` on a selected background is the one pairing that
never reads.
