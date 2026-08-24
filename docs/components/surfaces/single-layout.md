---
title: SingleLayout
parent: Surfaces, shells and resources
grand_parent: Components
---

# SingleLayout
{: .no_toc }

Shows one mount and ignores the rest.

```tsx
import { BUILTIN_LAYOUTS } from '@textui/widgets';

console.log(BUILTIN_LAYOUTS.map((layout) => layout.name));
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

A layout is not mounted directly - it is registered, and a surface names it.
`registerBuiltins` registers all seven, and a surface picks one through its
layout state.

`single` shows the active mount and draws nothing for the others. It is the
right choice for a surface that holds one thing at a time and does not need a
strip of tabs to say so.

## See also

- [TabsLayout](tabs-layout.md) - the same, with a chooser
- [SurfaceArea](surface-area.md) - selecting a layout
