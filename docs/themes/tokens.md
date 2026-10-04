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

The two selection backgrounds are a pair of their own: `selected` carries `onSelected` and `active` carries `onActive`. Both are *derived* - `onSelected` from the theme's `inverted` and `onActive` from its `text` - unless the theme states them, so a theme that restates one half of the pair cannot leave the other behind, and a component never has to know which theme it is under.

`dark` and `light` state all four, because they draw a selection with no fill: `selected` and `active` are `default`, and the selection is `onSelected` or `onActive` alone, in bold while the component has the keyboard. `paper` and `paper-dark` do the same. A theme that extends one of them and brings a fill back states its own `onSelected` and `onActive` as well, or it inherits an accent meant for the canvas and writes it on the fill - `console`, `workbench` and `paper-light` do.

## A token belongs to one channel

Every colour is one of three things, and a terminal cell has exactly one of each - so a token that is only ever a background has no business in `fg`, and saying `fg="canvas"` should not compile.

The three lists are `FgColorToken`, `BgColorToken` and `BorderColorToken`, in [`packages/core/src/types/style.ts`](https://github.com/softov/textui/blob/main/packages/core/src/types/style.ts). `ColorToken` is their union and is what a theme's `colors` map is keyed by, so a theme can still state any of them anywhere - the narrowing is on the field, where the mistake is made.

| Channel | Takes |
| :--- | :--- |
| `fg`, and the foreground of any border | `text muted subtle inverted`, the nine tones, the five states, the `on*` pairings, `borderSubtle`, `cursor` |
| `bg`, and `scrim` | `canvas surface surfaceAlt overlay`, the five states, the nine tones, `cursor`, `shadow` |
| a border's colour, and each of its sides | `border borderStrong borderSubtle divider`, the nine tones, `hover`, `focus`, and the two quiet foregrounds `muted subtle` |

Two are worth calling out. `cursor` is in both lists on purpose: an underline caret is drawn in the foreground and a block caret *is* the foreground swapped, so both halves are reached by naming it either way. And `muted` and `subtle` are legal rules as well as quiet labels, because a dim frame is a line somebody means; what the border list refuses is the loud end of the foreground list, where a rule in `text` or in an `on*` token is writing used as structure.

A literal is accepted anywhere a colour is, so nothing that used to compile stops working on the escape: `fg="#ff8800"`, `bg="red"`, `fg={{ rgb: [255, 136, 0] }}` all still type. That is deliberate - the point is to catch the mistake in the token vocabulary, not to make the escape hatch a second thing to argue about.

## A component states its states; the theme says what they look like

A component knows which states it is in. It does not know what they look like.

A list row states `selected`, and `focused` as well when the list has the keyboard:

```jsx
h('box', {
  role: 'listitem',
  styleAs: 'List',
  selected: active,
  focused: active && focus.focused,
})
```

and the theme answers:

<!-- docs:nocheck -->
```ts
components: {
  List: {
    selected: { bg: 'active', fg: 'onActive' },
    focus:    { bg: 'selected', fg: 'onSelected' },
  },
}
```

The shape is `components.<Component>.<state>`, with five state names:

| State | Means |
| :--- | :--- |
| `selected` | The row the selection is on |
| `hover` | The pointer is over it |
| `active` | It is pressed |
| `focus` | The component has the keyboard |
| `disabled` | It cannot be used |

`selected` and `focus` are the pair worth understanding, because they are the two halves of one thing. **A selection is remembered; a focused selection is live.** A list that has lost focus still shows where its selection is, and drawing that as loudly as the live one puts two cursors on the screen - which is what `List.selected` and `List.focus` are for. A tab strip is the one component that states `selected` and nothing else: a tab is *open*, not selected, and dimming it when the strip does not have the keyboard would claim no document is open, which is a different claim and a wrong one.

`disabled` wins over all of them, because it is the one that stops the component. Merging runs in the order `selected`, `hover`, `active`, `focus`, `disabled`, later winning, and the same order is applied to the theme's map - so the two cannot disagree about which state beats which.

### Which component a theme entry is about

`styleAs` is how a composite component names the box a theme styles. A list draws its rows as plain `box` nodes, so without it `components.List` would be a key nothing ever reads - which is what every `components` entry written for a composite component was, until this. The name is stated at the node, and the map is keyed by it.

A composite component with more than one kind of box can state more than one name, and a theme styles each separately. `Tabs` does exactly this, which brings the last piece.

`Panel` and `Button` are the two names in the built-in themes that are *not* reachable yet: neither draws a box of its own, so neither states a `styleAs`. Their entries are doing nothing. Reading them as working is the mistake to avoid.

### A state qualified by a variant

Sometimes the question a state answers is not "what colour" but "does it paint at all". A solid tab is filled and an underlined one is not, and `Tabs.selected` has to mean the pair for both.

So a state is also offered qualified by each of the props-driven names on the same node, immediately after the flat one and with the order between states unchanged:

<!-- docs:nocheck -->
```ts
components: {
  Tabs: {
    selected:          { fg: 'onSelected' },   // both variants
    'solid.selected':  { bg: 'selected' },     // and this one fills
  },
}
```

The qualified name merges last. Anything else a theme states about `Tabs.selected` still reaches a solid tab, and the fill is the one thing that only applies to one variant.

## The shell owns the page

A shell paints `canvas` and `text` across the terminal, which is what makes a theme a theme rather than a set of accent colours: without it a light theme is dark-theme ink on whatever background the terminal already had, and only the dialogs - which paint their own `overlay` - look light.

This is why `createApp({ root })` mounts that node into `main` rather than replacing the shell with it.

## Colour is inherited

A node with no `fg` takes its parent's; the same for `bg`, and attributes accumulate, so `bold` on a row is bold for what is in the row. A box's own always wins.

This is load-bearing rather than a convenience. A terminal cell holds exactly one foreground and one background, so a `text` that did not inherit would be drawn in the terminal's default colours *and* punch a hole through the fill behind it - which is a label in the wrong colour on a button and a ragged bar of default background across the middle of it.

The corollary, for anyone writing a component: a fixed `fg="muted"` inside a row that can be selected is a bug - `muted` on a selected background is the one pairing that never reads. On a **selected** row the inner texts take no `fg` at all, so they inherit the fill's own foreground: it is the theme that says what is written on a selection, and a hard `onSelected` in the component would be a second answer to the same question that a theme restating `Menu.focus.fg` could not reach.
