---
title: Spacer
parent: Layout and overflow
grand_parent: Components
---

# Spacer
{: .no_toc }

Empty space, greedy by default.

```tsx
import { Row, Spacer } from '@textui/core';

<Row>
  <text content="left" />
  <Spacer />
  <text content="right" />
</Row>
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `size` | `number` |  |  |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

The component and the [`<spacer>` primitive](../primitives/spacer.md) differ
in one way: this one is greedy without being told, so `<Spacer />` takes the
leftover room where `<spacer />` needs `flex={1}`. `size` fixes it at a
number of cells instead.

They are two different things whose names differ only in case. That is worth
knowing when reading a graph, where `{ component: 'Spacer' }` and
`{ component: 'spacer' }` are not the same node.

## See also

- [spacer](../primitives/spacer.md) - the primitive
- [Divider](divider.md) - space with a rule through it
