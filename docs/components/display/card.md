---
title: Card
parent: Display and data
grand_parent: Components
---

# Card
{: .no_toc }

A titled block that is filled, so it sits on what is behind it.

```tsx
import { Card } from '@textui/widgets';

<Card title="billing-worker" subtitle="eu-west-1" footer="updated 2m ago">
  <text content="42 jobs queued" />
</Card>
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `title` | `string` |  |  |
| `subtitle` | `string` |  |  |
| `footer` | `string` |  |  |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Where [`Panel`](../layout/panel.md) is a region you can focus, resize or scroll, a card is a block of content with a heading - the lighter of the two, and the one to reach for when several sit in a [`Grid`](../layout/grid.md).

It states `bg: 'surface'`, so it is opaque: dropped over a [`Pattern`](pattern.md), a scrim or a neighbouring block it reads as laid on top rather than as a hole in it. A box that states no background is a frame around whatever was already there, which is right for a container and wrong for a surface. A caller that wants a different fill names one - `bg` is spread last, so it wins.

## See also

- [Panel](../layout/panel.md) - a pane rather than a block
- [KeyValue](key-value.md) - for a card that is mostly field-and-value
