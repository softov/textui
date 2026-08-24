# showcase

Everything on one screen. Fifteen panels of the catalog, laid out as a row that
wraps, and a `--svg` flag so the result is a file you can put in a README.

```bash
pnpm build
node dist/src/main.js                         # run it
node dist/src/main.js --static                # one frame, as ANSI
node dist/src/main.js --svg showcase.svg      # one frame, as a picture
```

## Why it is a wrapping row and not a grid

A grid has to be told how many columns, and the right answer changes with the
terminal. This is one `Row` with `flexWrap="wrap"`, so it puts as many panels on
a line as fit and starts another - three columns on a wide terminal, two on a
laptop, one in a narrow pane, with no breakpoints to keep in step.

`--wrap` is the number that decides it: the width each panel asks for, which is
what the row breaks on. It is a flag rather than a constant because "how wide
should a panel be" is a judgement about the picture, not a property of the
catalog.

```bash
node dist/src/main.js --static --wrap 64      # two across
node dist/src/main.js --static --width 62     # one across, same --wrap
```

Two things follow from a stated width, and both matter:

- It is what **splits the line**. A wrapping row breaks on each child's stated
  width and falls back to measuring the content when there is none, which for a
  panel full of text is neither stable nor predictable.
- It is what the panel's contents are **measured against**, so text inside wraps
  at the width it will be drawn at rather than at whatever the whole row had.

`flex` then lets the panels on a line share out what is left over, so three at
40 fill 130 rather than leaving ten cells of gutter.

## A still is as tall as what is in it

Nobody knows how tall the picture is up front - it depends on the width, on
`--wrap`, and on how tall each panel came out. So a still with no `--height`
renders into a deliberately over-tall terminal and crops back to the rows that
were used. Pass `--height` to get exactly that many rows instead.

That is also why the screen has a `fit` mode. Filling the terminal is right for
an application - the grid takes the room between the two bars and scrolls what
does not fit - and wrong for a picture, where whatever scrolled is simply
missing.

## Other flags

| | |
|---|---|
| `--theme <id>` | `dark`, `light`, `console`, `paper`, `paper-dark`, `workbench`, `mono`. `t` cycles while it runs |
| `--only <id>` | one panel, for a picture of a single widget - `controls`, `charts`, `code`, … |
| `--width`, `--height` | the terminal to render into |
| `--unicode ascii`, `--colors 4` | force a degraded terminal, which is the fastest way to find out what a widget falls back to |

## The panels are functions of nothing

No state, no store, no props. That is what makes this a screenshot rather than a
program: a panel that read state would look different depending on when the
picture was taken, and a picture that cannot be reproduced is a reference for
nothing.

The controls are still real controls - they take focus, tab reaches them and the
keys work. What they do not have is a handler that changes what is drawn,
because a still of a slider at 40% is worth more than one at wherever the last
run left it.

## What it caught

The point of mounting the whole catalog on one screen is that holes show up.

`Alert` is a row: an icon beside a column holding the text. A wrapping text was
being **measured** against the whole row and then laid out in what was left of
it, so a message one cell too long came out a row short and lost its last word
off the bottom of the panel. Every list row, status line and alert in the
library has that shape, and it took a screen 40 cells wide to make it visible.
The fix is in `measureBox`, with the failing case in `packages/core/test`.

`Progress` counts against `total`, which is 1 unless you say otherwise, so
`value={72}` is "72 out of 1" and clamps to full. `Gauge` reads 0-100 already.
Two widgets, two conventions, and the only way to notice is to put them beside
each other.
