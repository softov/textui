---
title: FileDiff
parent: Chat
grand_parent: Components
---

# FileDiff
{: .no_toc }

One file out of a changeset, both sides of it lined up.

```tsx
import { FileDiff, diffLines } from '@textui/chat';

<FileDiff path="src/index.ts" kind="edited" diff={diffLines('const a = 1;', 'const a = 2;')} />
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `path` | `string` | **required** | The file, as the changeset names it. |
| `diff` | `DiffResult` | **required** |  |
| `kind` | `'new' \| 'edited' \| 'deleted'` | **required** | Absent `before` is a creation, absent `after` a deletion. |
| `binary` | `{ bytes: number; contentType?: string }` |  | Set instead of a diff when the bytes are not text. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Unified rather than side by side, and not for want of a splitter: a terminal that a changeset list already shares with a session pane has sixty columns left, and eighty characters of source in thirty is two columns of nothing legible.

Every row is exactly one row tall.
The scroll position is a row count, so a line that wrapped would put the gutter numbers out of step with what is on screen; long lines are clipped, and the file is there to be read rather than edited.

Both gutters are always drawn, because a single number that means the left file on one row and the right on the next is a number nobody can use to find anything.
The header says whether the file is `new`, `edited` or `deleted` and carries the added and removed counts.

Three things are shown instead of a diff: `binary`, a `diff` whose `tooLarge` is set, and one with no rows at all. Each is an `EmptyState` that says which of the three it is.

## See also

- [Line diff](line-diff.md) - how the rows were worked out
- [EmptyState](../display/empty-state.md) - what stands in for one that is not shown
- [ScrollView](../layout/scroll-view.md) - the viewport the rows are in
