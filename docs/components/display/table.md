---
title: Table
parent: Display and data
grand_parent: Components
---

# Table
{: .no_toc }

Columns with headers, responsive by dropping the least important.

```tsx
import { Table } from '@textui/core';

<Table
  columns={[
    { key: 'name', header: 'NAME', width: 18 },
    { key: 'status', header: 'STATUS', width: 10, priority: 90 },
    { key: 'cpu', header: 'CPU', width: 7, align: 'right', priority: 40 },
  ]}
  rows={[{ name: 'api', status: 'healthy', cpu: '2%' }]}
  rowKey="name"
/>
```

## Props

<!-- props:start -->
_No props of its own._
<!-- props:end -->

Role: `table`.

Narrowing **drops columns rather than squeezing them**. As the space runs out
the lowest `priority` goes first, and the first column never goes at all -
a row you cannot identify is not a smaller row, it is a useless one.

A column with no stated priority inherits its position, so it never ties with
one explicitly marked unimportant. Set `responsive={false}` to turn the whole
behaviour off.

`format` renders a cell and `tone` colours it, both from the value and the
whole row - which is how a latency column goes red past a threshold without
the rows carrying presentation.

## See also

- [List](list.md) - one column, with a selection
- [Pagination](pagination.md) - for when the rows do not all arrive at once
- [KeyValue](key-value.md) - one record rather than many
