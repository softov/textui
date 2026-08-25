---
title: box
parent: The four primitives
grand_parent: Components
---

# box
{: .no_toc }

The container. Flex layout, background, border, title and footer - and the only primitive that holds children.

```tsx
<box direction="column" border="single" title="Services" padding={1} gap={1}>
  <text content="api" />
  <text content="worker" />
</box>
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

A `box` is a flex container: `direction`, `gap`, `padding`, `align`, `justify`, `flex` and the rest of [the style keys](../base-props.md) all land here. `title` and `footer` are drawn *into* the border, so they need one to land on - without a border they are dropped rather than drawn as rows.

Because every node takes `role`, `label` and `onKey`, a bare box is already enough to build an interactive element:

```tsx
<box role="button" label="Restart" focusable onClick={() => {}}>
  <text content="Restart" />
</box>
```

That is a working, focusable, queryable button. [`Button`](../input/button.md) exists because it also draws a ring, carries a tone and inverts when focused.

## See also

- [Row](../layout/row.md), [Column](../layout/column.md) - a box with its direction already set
- [Panel](../layout/panel.md) - a titled box that follows the theme
- [Base props](../base-props.md) - the style keys a box accepts
