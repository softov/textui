---
title: Display and data
parent: Components
nav_order: 5
has_children: true
---

# Display and data

What shows a value: a label, a table of them, or a shape drawn from a series.

## Display

`Heading` `Label` `Badge` `StatusDot` `Card` `ColorText` `Marquee` `KeyValue` `Timeline`

`StatusDot` is the shared status vocabulary. A status is a glyph *and* a colour, because a 16-colour session, a colourblind reader and a piped log all lose the colour and keep the glyph.

`ColorText` is the exception that proves that rule: it colours a block of text cell by cell - a ramp, a palette walked in runs, or a function handed each cell - and everything it does is decoration. A banner, a title, ascii art. What a reader has to know still has to be in the words, because the ramp is the first thing an ssh session flattens.

## Data

`List` `Table` `Tree` `Pagination` `LogViewer` `CodeViewer` `MarkdownView` `Feed`

`Table` is responsive by column priority, not by squeezing: as it narrows it drops the lowest-priority column and never the first one, because a row you cannot identify is not a smaller row. A column with no stated priority inherits its position, so it never ties with one explicitly marked unimportant.

`LogViewer` follows the tail until the reader scrolls, then stops - the one behaviour that separates a log you can read from one that yanks itself away.

`Feed` is the one between `List` and `ScrollView`, and it is neither: `List` is fixed-height rows with a selection, `ScrollView` is a viewport that knows nothing about what is in it, and a feed is entries whose height is whatever their text wrapped to - with a cursor that moves between them and a tail it follows. A transcript, an activity stream, results with snippets and a diff whose files expand are all the same component.

Its heights are **measured, not computed**. What a paragraph wraps to is decided by the layout, so each entry reports its height once it has been laid out and the feed scrolls by summing them. That is one frame behind, which is invisible, and it is the only answer that is not a guess. Anything that needs the same trick - "how tall did that turn out to be" - can read how it is done there rather than inventing a second way.

`MarkdownView` draws markdown into the width it was given and does *not* scroll, because a document viewer owns its viewport and a message in a transcript does not. Pass `content` and it lays out what it measured; pass `rows` from `layoutMarkdown` plus a `window` and it paints that slice of somebody else's layout - which is exactly what `MarkdownViewer` in `@textui/documents` does with it. Inline emphasis, code and links survive the wrap, because in text a service or an agent wrote for a person they are meaning rather than markup.

`CodeViewer` is a viewport, not a column of lines: it renders the rows it was laid out into, scrolls with the keyboard and the wheel, slices each line to the visible columns rather than claiming the width of the longest one, expands tabs to real tab stops, and colours itself by asking the highlighter registry what opens the kind it was given. Opening a ten-thousand-line file costs what opening a ten-line one costs.

### How much do these draw?

All five take `visibleRows`, and none of them need it:

- Given `flex`, a `height`, a `maxHeight` or a `basis`, a data component renders **what fits** and scrolls, because in that case the layout decided its size and `useMeasure` reports it.
- Given none of those, it renders **everything** and its box grows, because then it is the content that decides - and clamping to a measurement would freeze a tree at whatever size it had when it was first drawn.

Which you get is decided by the props you pass, so a pane in a fixed frame scrolls and a small list in a document flows. State `visibleRows` only to override both.

## Charts

`Sparkline` `BarChart` `LineChart` `AreaChart` `Histogram` `Gauge` `Heatmap`

A terminal has one cell of resolution, so these subdivide a cell rather than pretending at pixels: eight block levels for bars and sparklines, a 2×4 braille grid for line and area plots - a 40×8 chart really has 80×32 plot positions. When braille is unavailable the plot falls back to block levels and still reads.

Every chart states its numbers as well as its shape. A shape without a scale is decoration.
