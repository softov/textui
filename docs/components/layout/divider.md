---
title: Divider
parent: Layout and overflow
grand_parent: Components
---

# Divider
{: .no_toc }

A rule, optionally labelled.

```tsx
import { Divider } from '@textui/widgets';

<Divider label="Danger zone" />
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `direction` | `'horizontal' \| 'vertical'` | `'horizontal'` | A divider runs across the flow, so it names its own axis. |
| `label` | `string` |  | Text set into the rule. |
| `labelAlign` | `'left' \| 'center' \| 'right'` | `'left'` |  |
| `char` | `string` |  |  |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Role: `separator`.

`direction` is `'horizontal'` by default; `'vertical'` draws a column rule
for splitting a row. `char` overrides the glyph, which matters on a terminal
that cannot draw box-drawing characters - though the theme already downgrades
that for you.

`labelAlign` takes `'left'` (the default), `'center'` or `'right'`.

## See also

- [Splitter](splitter.md) - a divider between two sized panes
- [spacer](../primitives/spacer.md) - the gap without the rule
