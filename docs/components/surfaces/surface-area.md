---
title: SurfaceArea
parent: Surfaces, shells and resources
grand_parent: Components
---

# SurfaceArea
{: .no_toc }

Renders one named surface wherever it is placed.

```tsx
import { SurfaceArea } from '@textui/widgets';

<SurfaceArea surface="main" />
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `surface` | `SurfaceName` | **required** |  |
| `layout` | `string` |  | Override the surface's stored layout. |
| `fallback` | `ComponentNode` |  | Rendered when the surface has no visible mounts. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

A surface is a named region that mounts are opened into. `SurfaceArea` is where one appears on screen, and how it arranges what is in it comes from the surface's own layout state rather than from here - so a pane can switch from tabs to a split at runtime without the markup changing.

**The name is yours to invent.** `SurfaceName` suggests the nine the shells use, but the registry never checks a name against a list; the first time it sees one it hands out default state. An application placing its own surfaces needs no shell at all.

Surfaces nest: a mount target is a node and this is a component, so a `SurfaceArea` inside another needs no support from anywhere.

`layout` pins the arrangement instead of reading it from state. `fallback` renders when nothing is mounted.

## See also

- [MountView](mount-view.md) - rendering one mount
- [TabsLayout](tabs-layout.md) and the other layouts - the arrangements
- [WorkbenchShell](workbench-shell.md) - surfaces already placed for you
