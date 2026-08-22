---
title: TextViewer
parent: Surfaces, shells and resources
grand_parent: Components
---

# TextViewer
{: .no_toc }

Plain text, for a resource with no more specific viewer.

```tsx
import { TextViewer } from '@textui/documents';

<TextViewer uri="file:///etc/hosts" />
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `resource` | `Resource` |  |  |
| `uri` | `string` |  |  |
| `content` | `string` |  |  |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Takes a `resource`, a `uri` or `content` directly - the last of which is
what makes it testable without a provider.

Registered against text kinds, and beaten by any viewer that claims something
more specific.

## See also

- [CodeViewer](../display/code-viewer.md) - the component underneath
- [FallbackViewer](fallback-viewer.md) - when even text is not right
