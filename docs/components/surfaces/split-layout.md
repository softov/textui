---
title: SplitLayout
parent: Surfaces, shells and resources
grand_parent: Components
---

# SplitLayout
{: .no_toc }

Two mounts, side by side, with a divider.

```tsx
import { BUILTIN_LAYOUTS } from '@textui/core';

const split = BUILTIN_LAYOUTS.find((layout) => layout.name === 'split');
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

The surface-level [`Splitter`](../layout/splitter.md). Where the divide sits
is surface state rather than a prop, so it survives the mounts changing and can
be moved by a command.

More than two mounts and the extras are stacked into the second pane.

## See also

- [Splitter](../layout/splitter.md) - the plain component
- [StackLayout](stack-layout.md) - no divide
