---
title: Panel
parent: Layout and overflow
grand_parent: Components
---

# Panel
{: .no_toc }

A titled region. Bordered or airy, whichever the theme asks for.

```tsx
import { Panel } from '@textui/widgets';

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
| `rightTitle` | `string` |  | Right-aligned text beside the title, on the same row. The short thing that belongs next to a heading rather than under it: a count, a state, the shortcut that opens it. Optional, and most panels do not have one. |
| `meta` | `string` |  | Right-aligned text on the *bottom* rule, where there is one. Not the title row - which is what this said for a long time while doing something else. A bordered panel put it in the footer and a borderless one put it beside the title, so the same prop meant two places depending on a different prop. `rightTitle` is the title row, in both; this is the bottom, and on a borderless panel there is no bottom to put it on. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Role: `region`.

`Panel` is the workhorse, and the one component that has to look right in all three house styles. Where the theme draws borders it renders `title` into the top rule; where the theme says `border: 'none'` it renders the title as a heading row instead. `meta` goes to the right of the bottom rule, or of the heading row.

A panel stretches to fill the row it is in. [`Row`](row.md) centres its children by default, and a pane floating in the middle of a taller neighbour is nobody's intent.

`tone` colours the border rather than the body, which is how a panel marks itself as the errored or the active one without repainting its contents.

## See also

- [Card](../display/card.md) - the same idea without the frame
- [box](../primitives/box.md) - a panel with nothing decided for you
- [Themes](../../themes/) - what `border: 'none'` changes
