---
title: Feed
parent: Display and data
grand_parent: Components
---

# Feed
{: .no_toc }

Entries whose height is whatever their text wrapped to, with a cursor and a tail.

```tsx
import { Feed } from '@textui/widgets';

<Feed flex={1} follow>
  <text content="a first entry" wrap="word" />
  <text content="a second, longer entry that will wrap" wrap="word" />
</Feed>
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `children` | `unknown` |  | The entries. Any height each - that is the whole point of this one. |
| `follow` | `boolean` |  | Stick to the newest entry. Turned off when the reader scrolls up, and back on at the bottom - a feed that yanks itself away is one you cannot read. |
| `onFollowChange` | `(follow: boolean) => void` |  |  |
| `selectedIndex` | `number` |  | The cursor, by index. Passed, the caller owns it; omitted, the arrows scroll by line instead, which is what a feed with nothing to activate wants. |
| `onSelect` | `(index: number) => void` |  |  |
| `onActivate` | `(index: number) => void` |  |  |
| `scrollbar` | `boolean` | `true` |  |
| `focusable` | `boolean` | `true` |  |
| `autoFocus` | `boolean` |  |  |
| `focusId` | `string` |  | So a command can send the reader here by name. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Role: `list`.

The one between [`List`](list.md) and [`ScrollView`](../layout/scroll-view.md), and it is neither: a list is fixed-height rows with a selection, a scroll view is a viewport that knows nothing about its contents, and a feed is entries of unequal height with a cursor that moves between them.

A transcript, an activity stream, search results with snippets, and a diff whose files expand are all this component.

Like the other data components it is sized by its props, not by \`visibleRows\`: given \`flex\`, a \`height\` or a \`maxHeight\` it fills that and scrolls; given none of them it draws every entry and lets the box grow. The second case matters more here than elsewhere, because clamping to a measurement inside a box sized *by* its own content clamps to nothing and the feed comes out empty.

Its heights are **measured, not computed**. What a paragraph wraps to is decided by the layout, so each entry reports its height once laid out and the feed scrolls by summing them. That is one frame behind, which is invisible, and it is the only answer that is not a guess.

## See also

- [List](list.md) - when every row is the same height
- [LogViewer](log-viewer.md) - when entries are single lines
- [ScrollView](../layout/scroll-view.md) - when there is nothing to put a cursor on
