---
title: KeyValue
parent: Display and data
grand_parent: Components
---

# KeyValue
{: .no_toc }

Label and value pairs, aligned into one or more columns.

```tsx
import { KeyValue } from '@textui/widgets';

<KeyValue
  columns={2}
  items={[
    { label: 'Region', value: 'eu-west-1' },
    { label: 'Status', value: 'degraded', tone: 'warning' },
  ]}
/>
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `items` | `{ label: string; value: string; tone?: 'default' \| 'primary' \| 'secondary' \| 'accent' \| 'success' \| 'warning' \| 'danger' \| 'info' \| 'muted' }[]` | **required** |  |
| `labelWidth` | `number` |  | Cells reserved for labels. Computed from the longest when unset. |
| `columns` | `number` | `1` |  |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Labels are aligned to a common width so the values line up; `labelWidth` fixes that width when two blocks must agree and their longest labels do not.

Per-item `tone` colours the value, not the label - the field name is not the thing that has gone wrong.

## See also

- [Table](table.md) - many records, one shape
- [Card](card.md) - a heading around a block of these
