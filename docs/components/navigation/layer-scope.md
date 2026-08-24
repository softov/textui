---
title: LayerScope
parent: Navigation and overlays
grand_parent: Components
---

# LayerScope
{: .no_toc }

Puts its children on a named layer, optionally trapping focus.

```tsx
import { LayerScope } from '@textui/widgets';

<LayerScope scopeId="inspector" trap>
  <text content="focus cannot leave this subtree" />
</LayerScope>
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `scopeId` | `string` | **required** |  |
| `trap` | `boolean` |  |  |
| `children` | `ComponentNode \| ComponentNode[]` |  |  |
<!-- props:end -->

The building block under [`Dialog`](dialog.md) and the menus. Reach for it
when you need modal behaviour around something that is not a dialog - an
inline editor that must keep the keyboard until it is finished, for instance.

`trap` keeps tab inside the subtree. Without it the scope groups for
dismissal and ordering but focus still moves through as usual.

## See also

- [Layers](../../platform/layers.md) - the planes and their order
- [Focus](../../platform/focus.md) - scopes and traps
- [Dialog](dialog.md) - this, already assembled
