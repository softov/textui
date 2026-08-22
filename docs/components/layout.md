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

`Row` `Column` `Center` `Grid` `Panel` `Divider` `Spacer` `Stack` `ScrollView` `Splitter`

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
