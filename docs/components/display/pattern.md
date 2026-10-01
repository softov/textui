---
title: Pattern
parent: Display and data
grand_parent: Components
---

# Pattern
{: .no_toc }

A tile, repeated - a texture under the children, or a motif over them.

```tsx
import { Pattern } from '@textui/widgets';

<Pattern tile={['◆◇', '◇◆']} ascii={['*.', '.*']} x={-1} y={-1} height={5}>
  <text content="written over the tile" />
</Pattern>
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `tile` | `string \| string[]` | **required** | The tile. One string per row, or one string with newlines in it. |
| `ascii` | `string \| string[]` |  | The tile to draw on a terminal that cannot manage the first one. A pattern is the one component whose whole content is glyphs, so it is the one that breaks worst on an `unicode: 'ascii'` terminal - and unlike a border, the library cannot guess a fallback for a tile it has never seen. Whoever picks the glyphs picks the substitute. |
| `x` | `number` |  | Repeats across. Unset or `0` draws the tile once. `-1` repeats until the box runs out. A positive number draws that many, and the box still clips it. |
| `y` | `number` |  | Repeats down. Same rules as `x`. |
| `limit` | `{ width?: number; height?: number }` |  | Stop short of the box, in cells. Unset means the box decides. |
| `spacing` | `{ x?: number; y?: number }` |  | Cells added after each copy, before the next one starts. Unset is flush, which is what a texture wants. Spacing turns the same tile into a motif with air around it - the difference between wrapping paper and a wallpaper: `10 + 10 = 20`, and `spacing.x = 5` makes it `25`. Not `gap`. A box already has one, it means the space between *children*, and a component that used the same word for the space between copies of its own tile would be two different distances under one name. |
| `jitter` | `{ x?: number; y?: number }` |  | Up to this many extra cells between copies, chosen at random per step. The standard name for it: a jitter is a random displacement applied to positions that would otherwise be regular, and breaking a lattice is what it is for. Not a deviation, which in statistics is a spread about a mean, and not a factor, which is what it multiplied before it was a limit. A limit, not a factor: `jitter.x = 6` is "somewhere between flush and six cells further on", dealt again for every step. Unset or `0` is the grid, every copy exactly a tile from the last, which is what the default preserves. It stacks with `spacing` rather than replacing it. Spacing is the air you always want and this is how much more of it is left to chance, so `spacing.x = 4, jitter.x = 6` steps by a tile plus four to ten. A jitter on `x` also stops the copies lining up into columns - see `offsets`, and the screenshot that made it necessary. |
| `seed` | `number` | `1` | The deal, when there is a jitter. A pattern re-renders whenever its box changes, and one that reached for `Math.random()` while painting would shuffle itself on every frame - a texture that crawls. The seed makes the scatter a function of the props, so the same pattern is the same pattern until somebody changes the number. |
| `transparent` | `string \| null` | `' '` | Cells holding this character are left unpainted, so whatever is behind shows through. `null` paints every cell, spaces included. |
| `ink` | `Ink` |  | Colour the tile cell by cell, the way [`ColorText`](color-text.md) colours text: a ramp between stops, a palette walked in runs, or a function of the cell. The coordinates are the pattern's own - `col` and `line` count cells of the box it fills, not of one copy of the tile - so `{ gradient }` runs across the whole texture and `{ cycle, every }` walks it. Stated, the tile is painted on a canvas rather than drawn as text, and a canvas is not told what it was nested in: every cell takes this component's own `fg` where the ink declines one, not the colour of the row it happens to sit in. That is the trade `ColorText` makes for the same reason, and it is the only difference between an inked tile and a plain one. |
| `asBackground` | `boolean` |  | Paint under the children. The default, and what a texture wants. |
| `asOverlay` | `boolean` |  | Paint over the children instead. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

The tile is one string per row, or one string with newlines in it, and a
ragged tile is padded rather than torn. `x` and `y` say how many copies:
unset or `0` draws it once, `-1` keeps going until the box runs out, and a
positive number draws exactly that and lets the box clip the rest.

`ascii` is the tile to draw where the first one cannot be. A pattern's whole
content is glyphs, which makes it the component that breaks worst on an
`unicode: 'ascii'` terminal - and unlike a border the library cannot guess a
substitute for a tile it has never seen, so whoever picks the glyphs picks the
fallback. Left unset, the tile is drawn as written and the terminal's own font
decides what that looks like.

`spacing` is cells added after each copy - the difference between wrapping
paper and wallpaper - and `jitter` is how much *extra* is left to chance per
step, so `spacing.x = 4, jitter.x = 6` steps by a tile plus four to ten.
Because a pattern repaints whenever its box changes, the scatter is dealt from
`seed` rather than from `Math.random()`: the same props are the same picture
until somebody changes the number, where a random would make a texture crawl.

Cells holding `transparent` are left unpainted so whatever is behind shows
through; it defaults to a space, and `null` paints every cell, spaces included.
`asBackground` (the default) puts the tile under the children and
`asOverlay` puts it over them.
Anything drawn over the tile that states no background of its own is
transparent to it, which is how a bordered box ends up as a frame around the
pattern: a `Card`, a `Dialog` and a `CommandPalette` state one, a bare `box`
does not.

`ink` colours the tile the way [`ColorText`](color-text.md) colours text - a
ramp between stops, a palette walked in runs, or a function of the cell - and
the coordinates it is handed are the pattern's own box rather than one copy of
the tile, so a gradient sweeps the whole texture and the second copy is not the
colour of the first. Stated, the tile is painted on a canvas, and a canvas is
not told what it was nested in: an inked tile takes this component's own `fg`
where the ink declines one instead of inheriting the colour of the row it sits
in. Without an `ink` the tile is text, and inherits like text.

## See also

- [canvas](../primitives/canvas.md) - the primitive, for a picture rather than a repeat
- [ColorText](color-text.md) - a second way to put colour on a block
- [Themes](../../themes/tokens.md) - the colour a tile is drawn in, inherited
