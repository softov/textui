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
| `items` | `KeyValueItem[]` | **required** |  |
| `labelWidth` | `number` |  | Cells reserved for labels. Computed from the longest when unset. |
| `labelGap` | `number` | `0` | Cells added to the longest label when the width is computed. The column is otherwise exactly as wide as its longest label, which leaves the value one gap after it; room here is what makes the values read as a column of their own rather than as the tail of the labels. Ignored when `labelWidth` states the width, which is exact. |
| `labelAlign` | `'left' \| 'right'` | `'left'` | Where a label sits in its column. `left` by default. |
| `valueAlign` | `'left' \| 'right'` | `'left'` | Where a value sits in what is left of the pair. `left` by default. |
| `columns` | `number` | `1` |  |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Labels are aligned to a common width so the values line up; `labelWidth` fixes that width when two blocks must agree and their longest labels do not.

`labelGap` adds room after the widest label, which is what makes the values read as a column of their own rather than as the tail of the labels. `labelAlign` and `valueAlign` move a label or a value to the right - for the whole block, and overridable on a single pair when one of them belongs the other way.

Per-item `tone` colours the value, not the label - the field name is not the thing that has gone wrong.

## See also

- [Table](table.md) - many records, one shape
- [Card](card.md) - a heading around a block of these
