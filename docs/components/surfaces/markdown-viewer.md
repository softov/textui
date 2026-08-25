---
title: MarkdownViewer
parent: Surfaces, shells and resources
grand_parent: Components
---

# MarkdownViewer
{: .no_toc }

A scrolling document view for markdown resources.

```tsx
import { MarkdownViewer } from '@textui/documents';

<MarkdownViewer uri="file:///README.md" />
```

## Props

<!-- props:start -->
_No props of its own._
<!-- props:end -->

The scrolling counterpart to [`MarkdownView`](../display/markdown-view.md): it lays the document out once with `layoutMarkdown`, owns the viewport, and hands the view a `window` of rows to paint.

That split is why a message in a transcript and a document in a pane can share one renderer while only one of them scrolls.

## See also

- [MarkdownView](../display/markdown-view.md) - the non-scrolling renderer
- [ResourceView](resource-view.md) - what selects this viewer
