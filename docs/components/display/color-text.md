---
title: ColorText
parent: Display and data
grand_parent: Components
---

# ColorText
{: .no_toc }

Multiline text coloured cell by cell - a ramp, a palette per line, or a function.

<!-- docs:setup
declare const banner: string;
-->

```tsx
import { ColorText } from '@textui/widgets';

<ColorText ink={{ gradient: ['cyan', 'magenta'] }} content={banner} alignBlock />
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `ink` | `Ink` |  | Left unset, this is an ordinary block of text. |
| `alignBlock` | `boolean` |  | Align the block as one thing, rather than each line on its own. `textAlign` centres every line over its own middle, which is right for prose and shears a picture: five rows of block letters do not have equal widths once the trailing spaces are gone, so each row lands somewhere slightly different and the letters lean. Under this, the whole block is placed once and the lines keep their offsets from each other. Off by default, because that is what `text` does and the two are supposed to mean the same thing by the same prop. |

Plus everything on [`TextProps`](../base-props.md).
<!-- props:end -->

A `text` takes one colour for the whole run, which is right for nearly
everything and no answer at all where the colour *is* the content - a banner, a
ramp across a title, a palette walked down a block of ascii art. Everything else
about this is a `text`: `wrap`, `truncate`, `textAlign` and the style keys
all mean here what they mean there.

`ink` is spelled three ways, and the first two are data:

<!-- docs:local
import { ColorText } from '@textui/widgets';
import type { Color } from '@textui/core';
declare const text: string;
declare const palette: Color[];
-->

```tsx
<box direction="column">
  <ColorText ink={{ gradient: ['#ff5f6d', '#ffc371'], axis: 'y' }} content={text} />
  <ColorText ink={['danger', 'warning', 'success']} content={text} />
  <ColorText ink={{ cycle: palette, every: [4, 3] }} content={text} />
  <ColorText ink={(cell) => (cell.index % 2 ? 'muted' : 'accent')} content={text} />
</box>
```

A **ramp** runs across the columns, down the lines, or corner to corner. It is
measured against the widest line of the block, so the rows of a banner share one
gradient and the colours line up down it; `per: 'line'` restarts it on each
line, which is what ragged prose wants.

A **cycle** walks a palette. An array on its own is the short spelling of one
colour per line. `every` is how much of the text each colour takes - a number,
or a repeating pattern of runs, so `[4, 3]` is four cells then three. The count
restarts on each line, which is what keeps the bands vertical; `continuous`
carries it over the line breaks and leans them into a diagonal. `unit` picks
what advances the colour: `cell` (the default, and the one that keeps a block
aligned), `grapheme`, `letter`, `word` or `line`.

A **function** is handed each cell and answers with a colour, a whole
`CellStyle`, or nothing - and nothing means "leave this one alone", which is
what makes an ink that colours only the vowels two lines long. The cell carries
a `col` *and* an `index` because they stop being the same number the moment
the text is not plain ascii: colour by `index` and paint at `col`, or a
gradient shears through the first wide character it meets.

Only the data forms survive being written in a JSON screen. A function prop
cannot be serialized - the same trade [`canvas`](../primitives/canvas.md)
makes with `draw`, and for the same reason: this paints on one.

Two consequences of that canvas are worth knowing. **Inherited colour stops
here**: a cell the ink declines takes this component's own `fg`, not the one a
parent row would have handed a `text`, so a `ColorText` inside something that
recolours its children when selected has to be told. And **a block that wraps
asks for no width** - it fills what it is given, the way anything that wraps
must; a block that does not wrap is as wide as its widest line and says so.

`alignBlock` is for pictures. `textAlign` centres every line over its own
middle, which is right for prose and shears a banner, because five rows of block
letters do not have equal widths once the trailing spaces are gone. Under
`alignBlock` the whole block is placed once and the lines keep their offsets
from each other.

The colour is decoration and never the message. A 16-colour session flattens a
six-stop ramp into a couple of bands and a piped log loses all of it, so
anything the reader has to know has to be in the words.

## See also

- [text](../primitives/text.md) - one colour, and the right answer nearly always
- [canvas](../primitives/canvas.md) - the primitive underneath, for cells that are not text
- [Themes](../../themes/tokens.md) - the tokens an ink can name
