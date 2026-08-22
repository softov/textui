---
title: BarLayout
parent: Surfaces, shells and resources
grand_parent: Components
---

# BarLayout
{: .no_toc }

Mounts along a single row.

```tsx
import { BUILTIN_LAYOUTS } from '@textui/core';

const bar = BUILTIN_LAYOUTS.find((layout) => layout.name === 'bar');
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

One row, mounts laid left to right, ordered by each mount's `order`. What the
`header` and `status` surfaces use.

A mount that does not fit is dropped rather than wrapped, because a status bar
that becomes two rows moves everything above it.

## See also

- [StatusBar](../navigation/status-bar.md) - the component for one such row
- [RailLayout](rail-layout.md) - the vertical equivalent
