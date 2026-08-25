---
title: StackLayout
parent: Surfaces, shells and resources
grand_parent: Components
---

# StackLayout
{: .no_toc }

Stacks every mount in the surface, one after another.

```tsx
import { BUILTIN_LAYOUTS } from '@textui/widgets';

const stack = BUILTIN_LAYOUTS.find((layout) => layout.name === 'stack');
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

All mounts visible, in order, down the surface. What a sidebar of collapsible sections wants, and what a surface holding a single mount degrades to harmlessly.

## See also

- [SplitLayout](split-layout.md) - two mounts with a divide
- [RailLayout](rail-layout.md) - icons rather than panels
