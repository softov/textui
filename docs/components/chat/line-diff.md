---
title: Line diff
parent: Chat
grand_parent: Components
nav_order: 3
---

# Line diff

Which lines of a file one side changed, from `@textui/chat`.

```tsx
import { diffLines, toLines } from '@textui/chat';

const result = diffLines('const a = 1;', 'const a = 2;');
const rows = result.rows;
const lines = toLines('one\ntwo\n');
```

A host sends two whole files and a count of what changed between them.
It does not send the diff itself, so somebody has to work out which lines those were, and this is that.

## `toLines`

`toLines` splits a file into lines, with the trailing newline not counted as an empty last line.
The empty string is no lines at all rather than one.

## `diffLines`

`diffLines(before, after, limit = 4000)` lines the two sides up and returns a `DiffResult`.

It is deliberately the textbook algorithm rather than anything clever: the longest common subsequence of the two line arrays, with everything not in it marked as removed on the left or added on the right.
The common head and tail are taken off first, because two files that differ in one line share everything either side of it and the quadratic part should only see the part that differs.
A tie goes to the removal, so a replaced line reads `-old` then `+new` the way every other diff on the machine prints it.

A creation has no before and a deletion no after, and both are passed as an empty string rather than as a special case - "every line is an addition" is exactly the right diff for a new file.

The cost is quadratic in the number of lines, which is what `limit` is for.
Over it, the result carries `tooLarge` with the line count and the limit instead of a diff, because the honest answer at that size is to say the files are too big rather than to spend a minute proving it.

## `DiffResult`

| Field | What it is |
| --- | --- |
| `rows` | The two sides, lined up, in file order. |
| `added`, `removed` | How many lines each way. |
| `tooLarge` | Set instead of a diff when the pair was over `limit`, with `lines` and `limit`. |

Each `DiffRow` has a `kind` of `same`, `added` or `removed`, a `text`, and a 1-based `before` and `after` number - each absent on the side the row does not exist on.

## See also

- [FileDiff](file-diff.md) - how the rows are drawn
- [CodeViewer](../display/code-viewer.md) - reading a whole file, rather than a change to it
- [ScrollView](../layout/scroll-view.md) - the viewport a diff is drawn in
