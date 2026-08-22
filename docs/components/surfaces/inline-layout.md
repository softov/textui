---
title: InlineLayout
parent: Surfaces, shells and resources
grand_parent: Components
---

# InlineLayout
{: .no_toc }

Mounts rendered one after another with no chrome at all.

```tsx
import { BUILTIN_LAYOUTS } from '@textui/core';

const inline = BUILTIN_LAYOUTS.find((layout) => layout.name === 'inline');
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `surface` | `SurfaceName` | **required** |  |
| `mounts` | `Mount[]` | **required** |  |
| `state` | `SurfaceState` | **required** |  |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

No tabs, no divider, no frame - the mounts and nothing else. For a surface
that is a hole in someone else's layout, where any decoration would be a second
frame around a thing already framed.

## See also

- [StackLayout](stack-layout.md) - the same order, with the surface's spacing
- [SurfaceArea](surface-area.md) - pinning a layout with `layout`
