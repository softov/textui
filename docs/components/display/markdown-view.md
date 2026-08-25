---
title: MarkdownView
parent: Display and data
grand_parent: Components
---

# MarkdownView
{: .no_toc }

Markdown laid out into the width it was given. Does not scroll.

```tsx
import { MarkdownView } from '@textui/widgets';

<MarkdownView content={'# Title\n\nSome **bold** text.\n'} />
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `content` | `string` | `''` | The document. Ignored when `rows` is passed. |
| `rows` | `MarkdownRow[]` |  | Already laid out - for a viewer that windows the rows itself. |
| `window` | `{ first: number; count: number }` |  | Paint only this slice. The caller owns the scrolling when it passes one. |
| `maxLines` | `number` |  | Collapse past this many rows, with a count of what is hidden. |
| `quiet` | `boolean` |  | Dim everything, for reasoning and other second-voice text. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Role: `document`.

It deliberately owns no viewport. A document viewer scrolls; a message inside a transcript does not, and making this scroll would put a second scrollable thing inside the first.

Two ways to drive it. Pass `content` and it lays out what it measured. Pass `rows` from `layoutMarkdown` plus a `window` and it paints that slice of somebody else's layout - which is exactly what [`MarkdownViewer`](../surfaces/markdown-viewer.md) does with it.

Inline emphasis, code and links survive the wrap, because in text a service or an agent wrote for a person those are meaning rather than markup.

## See also

- [MarkdownViewer](../surfaces/markdown-viewer.md) - the scrolling document viewer
- [Feed](feed.md) - what usually holds a stack of these
