---
title: MountView
parent: Surfaces, shells and resources
grand_parent: Components
---

# MountView
{: .no_toc }

Renders a single mount's target.

```tsx
import { MountView } from '@textui/core';
import type { Mount } from '@textui/core';

declare const mount: Mount;

<MountView mount={mount} />
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `mount` | `Mount` | **required** |  |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Every shipped layout delegates to this. A layout decides *where* a mount goes;
`MountView` decides what it draws, applying the mount's data context and its
display metadata.

You need it when writing a layout of your own, and almost never otherwise.

## See also

- [SurfaceArea](surface-area.md) - the region mounts appear in
- [Extension points](../../platform/extending.md) - registering a layout
