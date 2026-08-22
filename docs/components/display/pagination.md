---
title: Pagination
parent: Display and data
grand_parent: Components
---

# Pagination
{: .no_toc }

Page N of M, with the keys to move between them.

```tsx
import { Pagination } from '@textui/core';

<Pagination page={2} pageCount={9} total={412} onChange={(page) => console.log(page)} />
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `page` | `number` | **required** |  |
| `pageCount` | `number` | **required** |  |
| `total` | `number` |  |  |
| `onChange` | `(page: number) => void` |  |  |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

`page` is 1-based. `total` is the row count rather than the page count, and
is optional - it is there so the control can say "412 items" instead of only
"2 / 9".

Pagination is a control, not a data source: it reports where the reader wants
to be and something else fetches it.

## See also

- [Table](table.md) - what usually sits above it
- [Store](../../store/) - where the current page belongs
