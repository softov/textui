---
title: Label
parent: Display and data
grand_parent: Components
---

# Label
{: .no_toc }

A short name for something, in one of the semantic tones.

```tsx
import { Label } from '@textui/widgets';

<Label content="CPU" tone="muted" />
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `tone` | `'default' \| 'primary' \| 'secondary' \| 'accent' \| 'success' \| 'warning' \| 'danger' \| 'info' \| 'muted'` |  |  |

Plus everything on [`TextProps`](../base-props.md).
<!-- props:end -->

Role: `label`.

Use it for the name of a value rather than for prose. `tone` is the semantic scale - `muted` for a field name, `danger` for one that has gone wrong - so the colour survives a theme change and a downgrade to sixteen colours.

This is a display component and not the `label` *prop*, which every node takes and which names a node for the test harness and for accessibility.

## See also

- [KeyValue](key-value.md) - label and value pairs, already aligned
- [Base props](../base-props.md) - the `label` prop, which is a different thing
