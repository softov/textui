---
title: Layout and overflow
parent: Components
nav_order: 4
has_children: true
---

# Layout and overflow

The components that arrange space, and what happens when there is not enough
of it.

## Layout

`Row` `Column` `Center` `Grid` `Panel` `Divider` `Stack` `ScrollView` `Splitter`

`Panel` is the workhorse and the one that has to look right in all three house
styles: it renders its title into the border when it has one, and as a heading
row when the theme says `border: none`. `meta` goes to the right of the bottom
rule, or of the heading row. A panel also stretches to fill the row it is in,
because `Row` centres its children by default and a pane floating in the middle
of a taller neighbour is nobody's intent.

## When it does not fit

Two rules, and they differ by axis because terminals do:

- **Elastic before rigid.** A child with `flex` gives way first, weighted by how big it is. A header, a status bar and a fixed-width sidebar keep their size while the pane that asked to grow pays for the shortfall.
- **Sideways it shrinks; downwards it clips.** In a row, a rigid child narrows and its text truncates, which is how terminals have always narrowed. In a column it keeps its height and the overflow is cut, because a panel below the fold is readable and a panel with no bottom border is not.

`shrink` overrides both, in either direction. Nothing is ever placed outside its
container: a child that cannot fit is clipped to what remains, so a component
measuring itself always sees a size the terminal actually has.

A flexible child of a **row** is measured against the width its rigid siblings
leave it, not against the whole row. That matters for anything whose height
depends on its width, which is any wrapping text: an icon-and-message row
measured against the full width reports one line, is laid out two lines tall,
and loses the second off the bottom of whatever holds it.

## A row that wraps

`flexWrap="wrap"` puts as many children on a line as fit and starts another.
Useful where the column count is a function of the terminal rather than a
decision: three cards on a wide screen, two on a laptop, one in a narrow pane,
with no breakpoints to keep in step.

<!-- docs:nocheck -->
```tsx
<ScrollView flex={1}>
  <Row flexWrap="wrap" gap={1} align="start">
    {cards.map((card) => <Panel key={card.id} width={40} flex={1} title={card.title} />)}
  </Row>
</ScrollView>
```

Two things about that `width`. It is what **breaks the line** - a wrapping row
splits on each child's stated width and falls back to measuring the content
when there is none, which for a panel of text is neither stable nor
predictable. And it is what the child's own contents are measured against, so
text inside wraps at the width it will be drawn at. `flex` then shares out
what is left over on each line.

The viewport goes **around** the row, not on it. `overflowY` on the row itself
scrolls nothing: a box that overflows is not a viewport - somebody has to own
the offset, take the keys that change it and draw the bar that says how far
down you are, and that is what `ScrollView` is. Which axis it scrolls follows
from the wrapping: a wrapping row overflows *across* its main axis, having
already fitted everything along it, so the one that runs off the screen is the
other one. [`examples/showcase`](https://github.com/softov/textui/tree/main/examples/showcase)
is this layout and nothing else.
