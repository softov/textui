# ink

```bash
pnpm example ink
pnpm example ink -- --colors 4      # what an ssh session makes of it
pnpm example ink -- --unicode ascii # and a terminal with no block glyph
```

Type in the field - enter starts a second line - pick an ink and a font, and
watch the same component colour a banner or a paragraph. The panel scrolls, so
a tall font or three paragraphs of prose is not a clipped screen.

**A banner wraps, and it wraps in the text rather than in the drawing.** A line
of block letters cut at column sixty is a line of half letters, and five rows
each cut in a different place is not a word at all - so the letters are
measured in the chosen font *before* they are drawn and the break goes between
them. Words first; a word too wide for a line of its own is spent a character
at a time, because breaking `Deployment` in half is bad and dropping the second
half is worse.

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

## Eleven fonts, five tables

`block` is hand-drawn: five rows, one cell to a stroke, and **both cases on one
baseline** - lowercase sits on the bottom four rows and the ascenders reach up
into the fifth, so a cap is visibly taller than an x. Nothing descends below
the baseline, because five rows is not enough to put a tail under a `g` and
keep the line spacing honest, so `g` and `y` hook left instead.

Six of the eleven are that table, transformed - which is the other thing worth
showing: a bitmap font is a grid of characters, and a grid of characters can be
sheared, doubled, halved or re-inked in about fifteen lines. None of them can
lose a case, because the table has both.

| | |
|---|---|
| `wide` | every column drawn twice |
| `slant` | sheared half a column per row - an italic |
| `shadow` | the letter, and a copy one cell down and right in a second glyph |
| `half` | two rows to one row of half cells: five rows become **three** |
| `dots` | a dot across, a colon down; the junction goes to whatever comes down into it |
| `stars` | every lit cell a star with a gap after it |

Two have a subtlety worth knowing. `shadow` keeps the shadow only *outside* the
letter, found by a flood fill from the border, because one that fell into the
counter of an `A` turned a capital into a smudge. And `half` is the only font
that needs a character the theme has no name for - there is no token for half a
cell - so it is also the only place this example asks what the terminal can
show, and on an ascii one it is drawn in `"` and `_` instead.

`pagga` is the second table: **three rows of half cells on a `░` ground.** That
ground is the difference between it and `half`, and the point of it - `half`
draws letters and leaves the space around them empty, this draws them *on*
something, so a banner is a block of texture with the letters knocked out of it.
It is why its glyphs are four columns rather than three (the first is the
gutter, so letters butt together and the ground runs unbroken between them) and
why its space is a glyph of its own rather than a gap, which would be a hole in
it.

`gard` is the third table, and the biggest: **sixty-two glyphs of quotes,
pipes and dots**, transcribed from a font Softov brought. It is the only one
here with two cases of its own rather than a fold, and the only one whose
letters hang below the baseline - `J`, `g`, `j`, `p`, `q` and `y` all do. Every
glyph is stored nine rows tall so they agree where that baseline is; `banner`
trims the blank rows off a finished line, so a line of capitals comes out five
rows, one with a `g` in it six, and one with a digit seven.

Two things about it are worth knowing. **Its digits are not in the same hand as
its letters** - a script numeral beside a pipe-and-quote capital is what the
source has, and inventing a matching set would be replacing the font rather
than transcribing it. All that was edited is where they sit: they were two rows
lower than the letters, so `Gard 42` had its number sunk below its word. And
**it has no punctuation**, because the source had none - a `!` renders as the
gap any unknown character does.

`tmplt` is the fourth table: **three rows of heavy box-drawing**, transcribed
capital for capital from a font Softov brought - which is why its `X` is four
cells wide and its `I` is one, and why they are not going to be tidied into a
grid. Its digits and punctuation are drawn to match rather than transcribed,
because the source had none. It is also the only font here with nothing to
degrade to: box-drawing has no `#` the way a block does, so on an ascii
terminal it borrows `mini` - the same three rows, in characters a teletype has.

`mini` is the fifth table: **three rows, drawn in strokes rather than in
cells.** Three rows of solid cells cannot hold an alphabet - at that size a
solid `A` and a solid `M` are the same three-by-three block, and so are `G` and
`O`. The way out is the one every small figlet font takes: stop filling cells
and start drawing strokes, so a `|` and a `/` each carry a direction the cell
on its own could not. It has one case, and lowercase folds to it.

The fonts here are hand-drawn rather than converted from figlet `.flf` files on
purpose. FIGlet's own font licensing is [a long-standing muddle](https://github.com/pwaller/pyfiglet/issues/89) -
the original notice covers copying but not modification, and many fonts have
unknown origin - so nothing in this directory came from one.

## A missing character is visible

No font here has every character, and two of them are transcriptions of a
source that simply had none - `gard` has no punctuation at all. **A character a
font is missing is drawn as itself**, one cell, on the baseline.

The alternative was a gap, and a gap is indistinguishable from a space: in a
font with no punctuation, `hello, world!` came out as `hello  world` and looked
like it had worked. A literal `!` sitting on the line is legible, obviously not
part of the font, and says exactly which character is absent - which is also
what makes it worth pressing every key in the field and seeing what shows up.

## What the flags are for

Nothing in here is allowed to depend on the colour, and the flags are how that
gets checked rather than asserted. `--colors 4` reduces every 24-bit ink to the
sixteen the terminal has, and a six-stop spectrum comes out as a few bands.
`--unicode ascii` takes away the full block, and the banner is drawn in `#`
with a `-` shadow, because the fill glyphs came from the theme rather than from
the font.
