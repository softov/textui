---
title: TabsLayout
parent: Surfaces, shells and resources
grand_parent: Components
---

# TabsLayout
{: .no_toc }

Arranges a surface's mounts as tabs.

```tsx
import { BUILTIN_LAYOUTS } from '@textui/widgets';

const tabs = BUILTIN_LAYOUTS.find((layout) => layout.name === 'tabs');
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

One mount visible, a strip naming the others. Each tab's label comes from the mount's `display` metadata, so opening a mount is all it takes to add a tab.

This is the surface-level counterpart to [`Tabs`](../navigation/tabs.md). Use that one for panels you are laying out yourself; use this when the panels are mounts and their set changes at runtime.

## See also

- [Tabs](../navigation/tabs.md) - the plain control
- [StackLayout](stack-layout.md) - all of them at once
