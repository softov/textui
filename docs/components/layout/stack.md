---
title: Stack
parent: Layout and overflow
grand_parent: Components
---

# Stack
{: .no_toc }

A column whose spacing comes from the theme.

```tsx
import { Stack } from '@textui/widgets';

<Stack spacing="md">
  <text content="one" />
  <text content="two" />
</Stack>
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `spacing` | `'none' \| 'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl'` |  | Space between children, from the theme's scale. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

`Stack` is [`Column`](column.md) with `gap` taken from the theme's spacing
scale rather than from a number: `'none'`, `'xs'`, `'sm'`, `'md'`, `'lg'`,
`'xl'`.

Use it wherever the gap is "the usual one", so that changing the theme's
rhythm changes the screen. Use `Column` with an explicit `gap` where the
number is load-bearing and must not move.

## See also

- [Column](column.md) - an explicit gap
- [Themes](../../themes/tokens.md) - what the spacing scale resolves to
