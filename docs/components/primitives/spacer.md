---
title: spacer
parent: The four primitives
grand_parent: Components
---

# spacer
{: .no_toc }

Empty space. A fixed number of cells, or greedy when given flex.

```tsx
<box direction="row">
  <text content="left" />
  <spacer flex={1} />
  <text content="right" />
</box>
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `size` | `number` |  |  |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

`flex={1}` is the common case: it takes whatever is left, which is how two
things end up at opposite ends of a row. `size` fixes it at a number of cells
instead.

A spacer is not the only way to get gaps. Between *every* child, `gap` on the
container is shorter and does not need a node per space.

## See also

- [Spacer](../layout/spacer.md) - the component of the same name, greedy by default
- [Divider](../layout/divider.md) - space with a rule drawn through it
