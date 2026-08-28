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
| `pageKeys` | `'focused' \| 'always'` | `'focused'` | Who `pageup` and `pagedown` belong to. `focused` is the ordinary answer: the keys go to whatever has the keyboard. `always` claims them even while something else does - for the feed that *is* the screen, with a text field under it. Somebody typing a message who presses page up means the conversation above them; there is nothing else on that screen those keys could be for, and taking the keyboard away from the field to use them is the thing they are avoiding. Only those two keys, and only when the focused node has declined them first - so a field that pages its own content keeps them. |
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

Those heights are also what lets it stop drawing. Laying an entry out means wrapping its text, and a feed pays that for every entry it holds on every *frame* - not on every change, but on a keystroke in a field elsewhere on the screen, on a caret blinking, on a spinner. So an entry more than a screenful outside the viewport is replaced by a box of exactly the height it was measured at. Nothing is estimated: the first frame draws everything and learns every height, so the extent, the scrollbar and the position of every entry are what they would have been had all of them been drawn, and a resize throws the heights away and learns them again.

Two things follow from it. An entry far out of view is not mounted, so anything holding its own state - rather than taking it from the caller - loses it and starts again when the reader scrolls back. And an entry whose content changes while it is out of view keeps the height it last had until it is drawn again, which is right for a transcript that grows at the end and wrong for one that rewrites its middle.

## See also

- [List](list.md) - when every row is the same height
- [LogViewer](log-viewer.md) - when entries are single lines
- [ScrollView](../layout/scroll-view.md) - when there is nothing to put a cursor on
