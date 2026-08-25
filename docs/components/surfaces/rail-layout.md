---
title: RailLayout
parent: Surfaces, shells and resources
grand_parent: Components
---

# RailLayout
{: .no_toc }

A narrow vertical strip of mounts, usually icons.

```tsx
import { BUILTIN_LAYOUTS } from '@textui/widgets';

const rail = BUILTIN_LAYOUTS.find((layout) => layout.name === 'rail');
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

The activity strip down the left of a workbench. Each mount contributes an icon from its `display` metadata, and the rail stays narrow whatever they are.

Selecting one is what usually changes what the `sidebar` surface shows, but that wiring is the application's - the rail reports, it does not route.

## See also

- [WorkbenchShell](workbench-shell.md) - where a rail normally lives
- [BarLayout](bar-layout.md) - horizontal
