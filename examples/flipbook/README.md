# flipbook

An [ASCII Motion](https://asciimotion.com) document, played and edited in the
terminal.

```bash
node examples/run.mjs flipbook                 # the bundled sample
node examples/run.mjs flipbook --file mine.json
node examples/run.mjs flipbook --file mine.json --edit
```

## What it is for

Two things, and neither is about ASCII art.

**A per-cell animation needs no per-cell component.** The frame is one string
handed to one `<ColorText>`, and an ink function answers *what colour is this
cell* by looking the coordinate up in the frame's own map. Eighty by
forty-five is three and a half thousand cells and one node - a component per
cell would be three and a half thousand of them, laid out every frame.

```tsx
const paint = (cell: InkCell): CellStyle => {
  const found = frame.cells.get(key(originX + cell.col, originY + cell.line));
  return { fg: found?.color ?? film.ground, bg: film.ground };
};
```

**A timeline is not a frame rate.** Every frame in these documents carries its
own `duration`, and the sample holds one frame for 700ms and the next for 67.
So the ticker does not advance a frame per tick - it accumulates elapsed
milliseconds and advances when the current frame's hold is spent. `useTicker`
gives a delta, which is exactly the number that question needs:

```tsx
useTicker((_tick, delta) => {
  owed.current += delta;
  const hold = film.frames[at]?.duration ?? 100;
  if (owed.current < hold) return;
  owed.current -= hold;
  setIndex((at + 1) % film.frames.length);
}, { fps: 60, enabled: !editing && playing });
```

Run it at a fixed rate instead and the glide and the wingbeat become the same
length, which is the animation gone.

## Keys

| | |
|---|---|
| `ctrl+e` | play mode ⇄ edit mode |
| `tab` / `shift+tab` | next / previous frame, in either mode |
| `space` | play, pause *(play mode)* |
| `←` `→` | step a frame *(play mode)* |
| `←` `↑` `↓` `→` | move the cursor *(edit mode)* |
| any printable key | draw it at the cursor and advance *(edit mode)* |
| `backspace` `delete` | erase *(edit mode)* |
| `shift+←→` | hue |
| `shift+↑↓` | lightness |
| `ctrl+insert` | copy the cell under the cursor onto the brush |
| `shift+insert` / `alt+insert` | paste the brush at the cursor |
| `ctrl+s` | save back over `--file` |
| `ctrl+c` | quit |

| mouse | |
|---|---|
| click | put the cursor here |
| `ctrl`+click | copy this cell, and take its colour as the pen |
| `shift`+click / `alt`+click | paste the brush here |
| click a swatch or the ramp | take that colour |

Copying an empty cell is not a failure - it picks up a blank, which is the
erase brush, and pasting it clears the cell rather than leaving a painted space
behind. The two are different things in this format and only one of them is
really empty.

Both modified clicks do nothing while the animation is playing: the frame under
the pointer is about to change, so a paste would land somewhere you did not
choose.

**The modified clicks are not reliable, which is why the keys exist.** Most
terminal emulators use shift to bypass mouse reporting and run their own text
selection - xterm, GNOME Terminal and iTerm all do - so a `shift`+click never
reaches the application at all. `ctrl`+click fares better but is also claimed
by some. `ctrl+insert` and `shift+insert` are the X11 clipboard keys and arrive
as ordinary key sequences, so they work where the clicks do not; `alt+insert`
is accepted as well, for terminals that keep shift for themselves.

The cursor is an underline rather than a filled block, because a block hides
the character it is standing on - which is the one thing you need to see while
drawing over it. On an empty cell the rule takes the pen's colour, so the
cursor also answers what the next keystroke would draw in.

The colour keys are on shift-arrows rather than plain arrows because the plain
ones are the cursor, and a drawing surface cannot give those up. That is the
one place the keymap departs from what you might guess.

Two rules keep the colour keys from dying under you. Lightness stops short of
both ends, because `#ffffff` and `#000000` carry no hue and no saturation - walk
to either end and reading the hex back gives `{h: 0, s: 0}`, so the colour is
gone and no amount of pressing the hue key brings it back. And a hue step lifts
saturation to a floor, because hue is meaningless on a grey and this document's
palette is nearly all grey: `#141520` and `#8c916e` would otherwise swallow
every hue key you pressed and look broken.

The sidebar is mounted in both modes and is the same width in both. A column
that appears on `ctrl+e` narrows the pane beside it, and a narrower pane
re-frames the drawing - so the picture would jump at the exact moment you were
about to point at part of it.

## The format

`animation.frames[].data` is a sparse map keyed `"x,y"` - **column first** -
and any cell not listed is the canvas ground. Two traps live in that sentence:

- Reading the key row-first does not crash on a square-ish canvas. It draws the
  picture transposed, which looks like a rendering bug rather than a parsing one.
- A cell can hold a **painted space**: present in the data, prints nothing. Any
  bounding box that counts it is wrong. The sample's real content box is 42×6
  inside an 80×45 sheet, and that is what the viewport frames on.

Parsing keeps the whole original object, and saving writes back only
`animation.frames` and `canvas`, so `id`, `user_id`, `palettes`, `tools` and
anything a later version of the format adds survive a round trip. There are
tests for exactly that in [`test/motion.test.ts`](test/motion.test.ts).

## Files

| | |
|---|---|
| [`src/motion.ts`](src/motion.ts) | The format: parse, content box, used colours, save |
| [`src/palette.ts`](src/palette.ts) | HSL, because a keyboard steps hue and never steps red |
| [`src/app.tsx`](src/app.tsx) | Stage, sidebar, key handling |
| [`src/main.tsx`](src/main.tsx) | Entry, argument parsing, `mouse: true` |
| [`src/sample.ts`](src/sample.ts) | The bundled document, so it runs with no file |
