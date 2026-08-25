---
title: JsonViewer
parent: Surfaces, shells and resources
grand_parent: Components
---

# JsonViewer
{: .no_toc }

JSON as highlighted text.

```tsx
import { JsonViewer } from '@textui/documents';

<JsonViewer content={'{ "ok": true }'} />
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `resource` | `Resource` |  |  |
| `uri` | `string` |  |  |
| `content` | `string` |  |  |
| `lineNumbers` | `boolean` | `true` |  |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Role: `document`.

Ships with the JSON adapter rather than with the core catalog, so it is registered when that adapter is - which is why it and [`JsonTreeViewer`](json-tree-viewer.md) are in `@textui/documents`.

Text is the right default: it preserves key order and formatting, and a diff of it is readable.

## See also

- [JsonTreeViewer](json-tree-viewer.md) - the collapsible view of the same data
- [ResourceOpenWith](resource-open-with.md) - letting the reader pick between them
