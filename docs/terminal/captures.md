---
title: Keeping a frame
parent: Terminal
nav_order: 4
---

<!-- docs:setup
import { createApp } from '@textui/core'; declare const app: ReturnType<typeof createApp>; -->

# Keeping a frame

A terminal application cannot show you what it looked like when it went wrong. The screen *is* the output, and the next redraw destroys the evidence - so a bug report about layout is a photograph of a monitor, and one about a colour is a description of one.

Two functions write the frame out instead. Both take the buffer the runtime last painted and neither needs a tty, so they work from a test, from `--static` and from a live application alike.

## `captureBuffer` - a frame a terminal can replay

```ts
import { captureBuffer } from '@textui/terminal';

const ansi = captureBuffer(app.buffer(), app.capabilities);
const text = captureBuffer(app.buffer(), app.capabilities, { colors: false });
```

Every cell in order, rows separated by newlines, and no cursor control at all. This is not what the writer emits: the writer's job is to get from the frame on screen to the next one in as few bytes as it can, so what *it* produces is cursor moves and differences - correct on a live terminal and meaningless in a file. A capture can be written to a file, piped, pasted into an issue, or `cat`ed back with nothing else on screen having to be true.

`colors: false` gives the same frame with the colour stripped, which is the one a diff can read and a test can assert on.

## `bufferToSvg` - a frame a repository page can show

```ts
import { bufferToSvg } from '@textui/terminal';

const svg = bufferToSvg(app.buffer(), {
  background: app.theme.colors.canvas,
  foreground: app.theme.colors.text,
  title: 'the sessions screen',
});
```

An `.ans` file is only a screenshot on a terminal, which leaves the places that most want to show what a terminal application looks like - a README, a docs page, a pull request - as the ones that cannot replay one.

The output is **one self-contained SVG**: no font file, no stylesheet, no script, nothing fetched. That is what lets it survive GitHub, which serves images in markdown through a sanitising proxy that fetches nothing on the page's behalf.

It is also text, which is the part worth having. A committed SVG **diffs**: a change that moves a column or recolours a token turns up as a changed line in review, so a screenshot in the docs can be checked by CI rather than re-taken by hand and trusted.

### What it does with a cell

A row becomes a handful of runs rather than a rect and a `<text>` per cell - same picture, a fraction of the file. Backgrounds are emitted for the whole row before any glyph, because SVG has no z-index, only document order.

| | |
|---|---|
| `background`, `foreground` | What a cell left at the terminal's *own* colours becomes. A terminal has no answer for this - "default" means whatever the emulator is configured with - so a picture has to choose, and the honest choice is the caller's. Pass the theme's `canvas` and `text`. A theme may not have one either - `mono` is made of `default` - and either colour that comes through as `default` falls back to the exporter's own, because a picture with no ink is a rectangle. |
| `inverse` | Resolved into the two colours it swaps, which is only possible once both defaults are filled in. |
| `dim` | A colour part of the way to the one behind it. There is no "half as bright" for an arbitrary hex. |
| `bold`, `italic`, `underline`, `strike` | `font-weight`, `font-style` and `text-decoration`. |
| `blink` | Ignored. A still frame cannot blink, and an animation would make the file un-diffable for a flourish nobody asked for. |
| `colorDepth` | Reduce first, to show what a shallower terminal would have shown. Off by default: an SVG has no colour limit of its own, so downsampling as a default would be inventing a constraint. The cell is what gets reduced, not the two colours above: a cell left at the terminal's own colour has nothing to shrink, and still comes out as the ink and paper the picture was given. |

Every run is given a `textLength` in columns, so the grid holds even where the reader's monospace font has a different advance width from the one `cellWidth` was picked for - which is most readers.

A run stops wherever the colour, the attributes, or the *kind* of glyph changes. The last of those is what keeps the charts straight. `textLength` corrects a run as a unit, so a block or a braille glyph the reader's font has to substitute - at whatever advance width the substitute happens to use - would drag every letter beside it off the grid. Splitting at the boundary also lets the two kinds be adjusted the way each one wants: letters get `spacing`, because looser tracking is readable and squashed letterforms are not, and the drawing characters get `spacingAndGlyphs`, because spacing a run of blocks apart is how a solid bar comes out striped and a block stretched to fill its cell is still a block.

None of this shows in a theme that colours its bars differently from its text, because a colour change was already ending those runs. It shows in `mono`, where without it a whole row - letters, borders, and the bars between them - is one run corrected together.

## From an example

The chat example writes one from its `--static` path, which is how the pictures in the docs are made:

```bash
node dist/src/main.js --static --width 100 --height 30 \
  --session s-1 --screen chat --settled --svg chat.svg
```

It uses the theme's own two colours rather than the exporter's defaults, so the picture is of *that* application against the background it was drawn on.
