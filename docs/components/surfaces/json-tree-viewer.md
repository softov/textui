---
title: JsonTreeViewer
parent: Surfaces, shells and resources
grand_parent: Components
---

# JsonTreeViewer
{: .no_toc }

JSON as a collapsible tree.

```tsx
import { JsonTreeViewer } from '@textui/documents';

<JsonTreeViewer content={'{ "ok": true }'} />
```

## Props

<!-- props:start -->
_No props of its own._
<!-- props:end -->

Role: `tree`.

The other viewer for the same kind. A tree is better for finding one value in a large document and worse for reading the document, which is exactly why both are registered and the reader chooses.

## See also

- [JsonViewer](json-viewer.md) - the text view
- [Tree](../display/tree.md) - the control underneath
