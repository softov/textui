---
title: ResourceBreadcrumb
parent: Surfaces, shells and resources
grand_parent: Components
---

# ResourceBreadcrumb
{: .no_toc }

The path of a URI, as a trail you can walk back up.

```tsx
import { ResourceBreadcrumb } from '@textui/documents';

<ResourceBreadcrumb uri="file:///srv/api/main.ts" root="file:///srv" />
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `uri` | `string \| null` | **required** |  |
| `root` | `string` |  |  |
| `onSelect` | `(uri: string) => void` |  |  |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Splits the URI into segments and renders them as a [`Breadcrumb`](../navigation/breadcrumb.md). `root` trims the prefix so the trail starts at the workspace rather than at the filesystem root.

## See also

- [Breadcrumb](../navigation/breadcrumb.md) - the control underneath
- [ResourceExplorer](resource-explorer.md) - the tree it usually sits above
