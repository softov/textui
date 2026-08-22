---
title: Panel
parent: Layout and overflow
grand_parent: Components
---

# Panel
{: .no_toc }

A titled region. Bordered or airy, whichever the theme asks for.

```tsx
import { Panel } from '@textui/core';

<Panel title="Services" meta="12" padding={1}>
  <text content="api" />
</Panel>
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `title` | `string` |  | Section heading drawn into the border, or above a borderless panel. |
| `subtitle` | `string` |  |  |
| `tone` | `StyleColor` |  | Accent colour for the title. |
| `border` | `BorderSpec` |  | Overrides the theme's default border. `'none'` gives an airy panel. |
| `meta` | `string` |  | Right-aligned text in the title row. Counts, hints, shortcuts. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Role: `region`.

`Panel` is the workhorse, and the one component that has to look right in all
three house styles. Where the theme draws borders it renders `title` into the
top rule; where the theme says `border: 'none'` it renders the title as a
heading row instead. `meta` goes to the right of the bottom rule, or of the
heading row.

A panel stretches to fill the row it is in. [`Row`](row.md) centres its
children by default, and a pane floating in the middle of a taller neighbour is
nobody's intent.

`tone` colours the border rather than the body, which is how a panel marks
itself as the errored or the active one without repainting its contents.

## See also

- [Card](../display/card.md) - the same idea without the frame
- [box](../primitives/box.md) - a panel with nothing decided for you
- [Themes](../../themes/) - what `border: 'none'` changes
