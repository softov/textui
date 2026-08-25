---
title: FallbackViewer
parent: Surfaces, shells and resources
grand_parent: Components
---

# FallbackViewer
{: .no_toc }

What opens when nothing else claims the resource.

```tsx
import { FallbackViewer } from '@textui/documents';

<FallbackViewer uri="file:///srv/blob.bin" />
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `resource` | `Resource` |  |  |
| `uri` | `string` |  |  |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Shows what is known - the URI, the kind, the size - and says plainly that there is no viewer for it. It exists so an unknown kind is a readable message rather than an empty pane or a crash.

Registering a viewer for the kind is what replaces it.

## See also

- [Viewers, editors and actions](../../documents/viewers.md) - registering one
- [EmptyState](../display/empty-state.md) - the component it reads like
