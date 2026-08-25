# ink

```bash
pnpm example ink
pnpm example ink -- --colors 4      # what an ssh session makes of it
pnpm example ink -- --unicode ascii # and a terminal with no block glyph
```

Type in the field - enter starts a second line - pick an ink and a font, and
watch the same component colour a banner or a paragraph. The panel scrolls, so
a tall font or three paragraphs of prose is not a clipped screen.

## What it is for

`ColorText` colours a block of text cell by cell. The example is a banner
because that is where per-cell colour is worth anything, but **the component
has no idea what a banner is** - `ctrl+p` swaps the block letters for ordinary
prose and every ink in the list still applies, unchanged. The fonts are
[`src/fonts.ts`](src/fonts.ts), which is application data and deliberately not
something the library ships.

## The three ways to write an ink

The list runs top to bottom through all of them, and
[`src/inks.ts`](src/inks.ts) is where they are written.

**A ramp.** `{ gradient: ['#ff5f6d', '#ffc371'] }`, with an `axis` of `x`, `y`
or `xy`. The ramp is measured against the widest line of the block by default,
so five rows of block letters share one gradient and the colours line up down
the block; `per: 'line'` restarts it on each line instead, which is what
ragged prose wants.

**A palette.** An array is one colour per line. `{ cycle, every: [4, 3] }` is
four cells of one colour, three of the next, and round again - and the run
restarts on each line, which is what keeps the bands vertical. `continuous`
carries the count over the line breaks and leans them into a diagonal.
`unit` picks what advances the colour: cells, graphemes, letters, words, lines.

**A function.** `(cell, ctx) => colour`. The cell carries `char`, `col`,
`line`, `index`, `offset`, `width`, `height` and `blockWidth` - a column *and*
an index, because they stop being the same number the moment the text is not
plain ascii. Returning nothing leaves that cell the component's own colour,
which is what makes `vowels` two lines long.

The first two are data and would survive being written in a JSON screen. The
third would not, and that is the trade: it is the same one `canvas` makes with
`draw`.

## The fonts are one table and three transforms

`block` is hand-drawn: five rows, one cell to a stroke, and **both cases on one
baseline** - lowercase sits on the bottom four rows and the ascenders reach up
into the fifth, so a cap is visibly taller than an x. Nothing descends below
the baseline, because five rows is not enough to put a tail under a `g` and
keep the line spacing honest.

The other three are that table, transformed:

| | |
|---|---|
| `wide` | every column drawn twice |
| `slant` | sheared half a column per row - an italic |
| `shadow` | the letter, and a copy one cell down and right in a second glyph |

Which is the other thing worth showing: a bitmap font is a grid of characters,
and a grid of characters can be sheared, doubled or duplicated by ten lines of
code. `shadow` has one subtlety - the shadow is kept only *outside* the letter,
found by a flood fill from the border, because a shadow that fell into the
counter of an `A` turned a five-row capital into a smudge.

## What the flags are for

Nothing in here is allowed to depend on the colour, and the flags are how that
gets checked rather than asserted. `--colors 4` reduces every 24-bit ink to the
sixteen the terminal has, and a six-stop spectrum comes out as a few bands.
`--unicode ascii` takes away the full block, and the banner is drawn in `#`
with a `-` shadow, because the fill glyphs came from the theme rather than from
the font.
