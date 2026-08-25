---
title: Column
parent: Layout and overflow
grand_parent: Components
---

# Column
{: .no_toc }

A vertical flex container.

```tsx
import { Column } from '@textui/widgets';

<Column gap={1} flex={1}>
  <text content="one" />
  <text content="two" />
</Column>
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `children` | `unknown` |  |  |
| `title` | `string` |  | Header text drawn into the top border. Needs a border to land on. |
| `titleAlign` | `'left' \| 'center' \| 'right'` |  |  |
| `rightTitle` | `string` |  | A second label on the top border, hard against the right. For the short thing that belongs beside a heading rather than under it - a count, a shortcut, a state. It takes its space first and `title` gets what is left, so the two never collide and the title is the one that truncates. |
| `footer` | `string` |  | Footer text drawn into the bottom border. |
| `footerAlign` | `'left' \| 'center' \| 'right'` |  |  |
| `scrollTop` | `number` |  | Scroll offset in cells, when overflow is 'scroll'. |
| `scrollLeft` | `number` |  |  |

Plus everything on [`BaseProps`](../base-props.md).
<!-- props:end -->

Downwards is the axis that clips. Where a row narrows its children, a column keeps their height and cuts the overflow - because a panel below the fold is still readable and a panel with no bottom border is not.

Give exactly one child `flex={1}` to make it absorb the leftover height; that is how a header, a body and a status bar divide a screen.

## See also

- [Row](row.md) - the same thing, horizontally
- [Stack](stack.md) - a column whose spacing comes from the theme
- [ScrollView](scroll-view.md) - when the content is taller than the space
