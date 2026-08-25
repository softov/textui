---
title: Heading
parent: Display and data
grand_parent: Components
---

# Heading
{: .no_toc }

A section heading, sized and toned by the theme.

```tsx
import { Heading } from '@textui/widgets';

<Heading content="Services" level={1} />
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `level` | `1 \| 2 \| 3` |  |  |

Plus everything on [`TextProps`](../base-props.md).
<!-- props:end -->

Role: `heading`.

Three levels. What each one looks like is the theme's business - bold, a colour, a rule underneath - and a terminal has no font sizes to fall back on, so the difference between `1` and `3` is weight and colour rather than height.

`Heading` extends [`TextProps`](../base-props.md), so `truncate`, `textAlign` and `wrap` all work.

## See also

- [Label](label.md) - a name for something, not a section
- [Panel](../layout/panel.md) - a titled region, which draws its own heading
