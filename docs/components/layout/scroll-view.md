---
title: ScrollView
parent: Layout and overflow
grand_parent: Components
---

# ScrollView
{: .no_toc }

A scrolling viewport, with keyboard and wheel support.

```tsx
import { ScrollView } from '@textui/widgets';

<ScrollView flex={1}>
  <text content="a document taller than the space it was given" wrap="word" />
</ScrollView>
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `offset` | `number` |  | Controlled offset. Omit to let the view manage its own. |
| `onScroll` | `(offset: number) => void` |  |  |
| `scrollbar` | `boolean` | `true` | Draw a scrollbar on the right when the content overflows. |
| `focusable` | `boolean` | `true` | A tab stop, so the keys that scroll it can reach it. On by default: a viewport had the arrow handlers all along and registered nothing, so unless the caller happened to make it focusable itself the only way to scroll was the wheel - which is to say, on a keyboard, not at all. Turn it off for a view that scrolls inside something already focused. |
| `autoFocus` | `boolean` |  |  |
| `focusId` | `string` |  | A stable focus id, so a command - or the screen that owns this - can put the reader here by name. Without one the id comes from the instance, which nothing outside the render can know: "scroll the preview" has nothing to name and the key that would do it cannot be written. Every other focusable control takes one; this was the exception, and there was no reason for it. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Focusable by default, because a viewport nobody can put the keyboard into can only be scrolled with a mouse. It draws a scrollbar unless told not to.

It knows nothing about what is inside it - it scrolls cells. That is the difference between this and the data components: [`List`](../display/list.md) scrolls by rows and keeps a selection, [`Feed`](../display/feed.md) scrolls by measured entries, and a `ScrollView` scrolls whatever it was handed.

Pass `offset` and `onScroll` to hold the position in the store rather than inside the component, which is what lets a screen restore where the reader was.

## See also

- [List](../display/list.md), [Feed](../display/feed.md) - scrolling that understands its contents
- [CodeViewer](../display/code-viewer.md) - a viewport over lines, not cells
