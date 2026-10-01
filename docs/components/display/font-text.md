---
title: FontText
parent: Display and data
grand_parent: Components
---

# FontText
{: .no_toc }

Text drawn in a block font, one glyph table to a letter.

```tsx
import { FontText, fontAt } from '@textui/widgets';

<FontText content="TextUI" font={fontAt('block')} fg="accent" />
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `content` | `string` | **required** | The text to draw. A newline is a line, and each is a line of banner. |
| `font` | `Font` |  | The font to draw it in. The shipped `block` table by default. A font may name a substitute for a terminal that cannot draw its glyphs - `fallback` - and that is used here in place of it. There is no guessing one for a table the library has never seen, which is why the font says. |
| `wrap` | `'none' \| 'word'` |  | Break the text between its words so the drawn banner fits the box. `'none'` - the default - draws the text as it was written, however wide that is: a banner is usually a size somebody picked, and at a width the caller did not intend, letters that reflow are worse than letters that overflow. `'word'` asks the box for its width and breaks the text to it, words first and a word too wide for a line of its own spent a character at a time, which is the only place a letter boundary is ever crossed. It measures the box, so the first frame - which has no width yet - draws one unbroken line, exactly as `'none'` would. |
| `lineGap` | `number` |  | Blank rows between one line of the block and the next. One by default. Not `gap`, which every box already has and means the space between its *children*: this is the space between the rows of one drawing. `0` butts the lines together, which for a font with a ground of its own - `pagga`'s `░`, `tmplt`'s rules - merges them into one texture; a larger number is air between them, and reads as two lines rather than as one. A newline in `content` is a line, and so is a wrap when `wrap: 'word'` is breaking the text: the gap is the same one either way. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

A font is data: a table of glyphs, a tracking between letters and a width for
a space. The library ships a few - `FONTS`, or `fontAt(id)` for one by
name - and `Font` is the whole contract, so an application can bring its own
table without asking anyone.

What the component adds over the string is the mapping. A table is written in
placeholders - `#` a full cell, `%` a lighter one, `^` and `v` the two
halves - and those are filled from the theme's own glyphs, which is what keeps a
banner legible on a terminal that can only do ascii or only do sixteen colours.
So is the colour: the output is a `text` node and inherits like one.

`wrap` here is not `BoxProps.wrap`. On a `text` it says where a line of
*characters* is cut - and the block this draws is not a line of characters: its
rows are the rows of the letters, so cutting one at column sixty cuts every
letter in it in half. So it takes `'none'`, the default, or `'word'`, which
breaks the *text* between its words, measured in the font before anything is
drawn, and spends a word too wide for a line of its own a character at a time -
the only place a letter boundary is ever crossed. `'none'` is the default
because a banner is usually a size somebody picked, and at a width the caller
did not intend, letters that reflow are worse than letters that overflow. The
rows handed to the `text` node are always drawn unwrapped; a caller cannot
reach that.

`bannerLines` is the same text one line at a time, for a caller
that places the lines itself - `ColorText` per line, each with `alignBlock` and
`textAlign="center"`, is how every line gets centred rather than the block. The
ink restarts on each piece, so a block drawn that way is one component per line
and not one continuous ramp.

`lineGap` is the blank rows between one line of the block and the next: one by
default, `0` to butt them together - which, for a font with a ground of its own
like `pagga`'s `░`, merges two lines into one texture - and any larger number
for air between them. It is the same gap whether the line came from a newline in
`content` or from `wrap: 'word'` breaking a long one.

This is the shape half of a pair. Colouring the letters cell by cell - a ramp
across a banner, a palette down it - is [`ColorText`](color-text.md), and the
two meet over the string: `banner(content, font, inkGlyphs(theme.glyphs))`
returns what `ColorText` wants. A font may also name a `fallback` - another
font of the same height - for a terminal that cannot draw its glyphs, because
there is no guessing a substitute for a table the library has never seen.

## See also

- [ColorText](color-text.md) - the other half: colour, cell by cell
- [text](../primitives/text.md) - what this draws with, and what it inherits from
- [Themes](../../themes/tokens.md) - the glyphs and colours the placeholders resolve to
