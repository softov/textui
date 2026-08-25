---
title: ResourceOpenWith
parent: Surfaces, shells and resources
grand_parent: Components
---

# ResourceOpenWith
{: .no_toc }

The viewers that can open this resource, for the reader to choose.

```tsx
import { ResourceOpenWith } from '@textui/documents';

<ResourceOpenWith resource={null} onChoose={(viewer) => console.log(viewer.id)} />
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `resource` | `Resource \| null` | **required** |  |
| `onChoose` | `(viewer: ResourceViewerDefinition) => void` |  |  |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

More than one viewer can claim a kind - JSON opens in a syntax-highlighted view or a collapsible tree, and neither is always right. This lists the candidates; pass the chosen id back as [`ResourceView`](resource-view.md)'s `viewerId`.

## See also

- [ResourceView](resource-view.md) - the `viewerId` prop
- [JsonViewer](json-viewer.md), [JsonTreeViewer](json-tree-viewer.md) - two viewers, one kind
