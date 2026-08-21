---
title: Display and data
parent: Components
nav_order: 2
---

# Display and data

What shows a value: a label, a table of them, or a shape drawn from a series.

## Display

`Heading` `Label` `Badge` `StatusDot` `Card` `KeyValue` `Timeline`

`StatusDot` is the shared status vocabulary. A status is a glyph *and* a colour,
because a 16-colour session, a colourblind reader and a piped log all lose the
colour and keep the glyph.

## Data

`List` `Table` `Tree` `Pagination` `LogViewer` `CodeViewer`

`Table` is responsive by column priority, not by squeezing: as it narrows it
drops the lowest-priority column and never the first one, because a row you
cannot identify is not a smaller row. A column with no stated priority inherits
its position, so it never ties with one explicitly marked unimportant.

`LogViewer` follows the tail until the reader scrolls, then stops - the one
behaviour that separates a log you can read from one that yanks itself away.

`CodeViewer` is a viewport, not a column of lines: it renders the rows it was
laid out into, scrolls with the keyboard and the wheel, slices each line to the
visible columns rather than claiming the width of the longest one, expands tabs
to real tab stops, and colours itself by asking the highlighter registry what
opens the kind it was given. Opening a ten-thousand-line file costs what opening
a ten-line one costs.

### How much do these draw?

All five take `visibleRows`, and none of them need it:

- Given `flex`, a `height`, a `maxHeight` or a `basis`, a data component renders **what fits** and scrolls, because in that case the layout decided its size and `useMeasure` reports it.
- Given none of those, it renders **everything** and its box grows, because then it is the content that decides - and clamping to a measurement would freeze a tree at whatever size it had when it was first drawn.

Which you get is decided by the props you pass, so a pane in a fixed frame
scrolls and a small list in a document flows. State `visibleRows` only to
override both.

## Charts

`Sparkline` `BarChart` `LineChart` `AreaChart` `Histogram` `Gauge` `Heatmap`

A terminal has one cell of resolution, so these subdivide a cell rather than
pretending at pixels: eight block levels for bars and sparklines, a 2×4 braille
grid for line and area plots - a 40×8 chart really has 80×32 plot positions.
When braille is unavailable the plot falls back to block levels and still reads.

Every chart states its numbers as well as its shape. A shape without a scale is
decoration.
