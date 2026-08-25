---
title: Spinner
parent: Display and data
grand_parent: Components
---

# Spinner
{: .no_toc }

Work in progress, with no measurable amount of it.

```tsx
import { Spinner } from '@textui/widgets';

<Spinner label="Connecting" />
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `label` | `string` |  |  |
| `tone` | `'default' \| 'primary' \| 'secondary' \| 'accent' \| 'success' \| 'warning' \| 'danger' \| 'info' \| 'muted'` |  |  |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Role: `status`.

Use it only when the duration is genuinely unknown. Anything with a numerator and a denominator should be a [`Progress`](progress.md), because a spinner tells a reader nothing except that the program has not died.

The frames come from the theme's glyph set and degrade to ASCII where the terminal cannot draw them.

## See also

- [Progress](progress.md) - when the size is known
- [Skeleton](skeleton.md) - when the shape of what is coming is known
