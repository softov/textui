---
title: spacer
parent: The four primitives
grand_parent: Components
---

# spacer
{: .no_toc }

Empty space. Greedy by default, or a fixed number of cells.

```tsx
<box direction="row">
  <text content="left" />
  <spacer />
  <text content="right" />
</box>
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `size` | `number` |  | Cells to take. Unset means "take whatever is left", the same as `flex: 1`. |

Plus everything on [`BaseProps`](../base-props.md).
<!-- props:end -->

Bare is the common case: with no `size` it takes whatever is left, which is how two things end up at opposite ends of a row. `size` fixes it at a number of cells instead, and `flex` is there when you want a share rather than all of it.

`Spacer` is the same node under a Capitalized name, for a file written in one case. There is no separate component - there was one, and the two differed only in whether they were greedy, which is not a difference worth a second name.

A spacer is not the only way to get gaps. Between *every* child, `gap` on the container is shorter and does not need a node per space.

## See also

- [Divider](../layout/divider.md) - space with a rule drawn through it
- [Row](../layout/row.md) - `gap`, for space between every child
