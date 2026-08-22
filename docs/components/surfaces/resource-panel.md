---
title: ResourcePanel
parent: Surfaces, shells and resources
grand_parent: Components
---

# ResourcePanel
{: .no_toc }

A place a resource is shown, by whichever renderer is registered for it.

```tsx
import { ResourcePanel } from '@textui/core';

<ResourcePanel uri="file:///srv/api/main.ts" />
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `id` | `string` |  | This panel's identity, and the focus scope it makes. A panel with no id still works and still remembers - it takes the scope id the runtime generates - but that id dies with the mount, so it forgets when it is unmounted. Naming a panel is what makes it a place. |
| `uri` | `string \| null` | **required** |  |
| `renderer` | `string` |  | Force a renderer, ignoring what the panel remembers. |
| `mode` | `'view' \| 'edit'` |  | What the caller wants, when it has no renderer in mind: `edit` asks for one that writes back. An intent, resolved against whatever is registered - not a second way of naming a component. |
| `rendererProps` | `Record<string, unknown>` |  | Props for whichever renderer is chosen. The caller does not know which. |
| `fallbackComponent` | `string` |  | Component to mount when nothing is registered for the kind. |
| `autoFocus` | `boolean` |  | Claim the keyboard when nothing else holds it. |
| `emptyTitle` | `string` |  |  |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

The panel is the *place*; what fills it is decided by the resource registry.
Hand it a URI and it asks what renders that kind - an editor when `mode` is
`'edit'` and one is registered, a viewer otherwise, the fallback when nothing
claims it.

`uri` takes `null` so a panel can stand empty with `emptyTitle` rather than
being unmounted, which keeps the layout still while nothing is open.

`renderer` pins one instead of asking, and `rendererProps` is passed through
to it. Registering `registerBuiltins` also registers the panel's commands -
"open with" reads its options off the resource registry, so a host that mounts
a panel has already said everything those commands need. The keys stay yours.

## See also

- [ResourceView](resource-view.md) - the same resolution without the panel chrome
- [Viewers, editors and actions](../../documents/viewers.md) - what gets registered
- [Commands](../../platform/commands.md) - the panel's own commands
