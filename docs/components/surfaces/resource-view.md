---
title: ResourceView
parent: Surfaces, shells and resources
grand_parent: Components
---

# ResourceView
{: .no_toc }

Opens a URI with whichever viewer the registry says fits.

```tsx
import { ResourceView } from '@textui/documents';

<ResourceView uri="file:///etc/hosts" />
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `uri` | `string \| null` | **required** |  |
| `id` | `string` |  | The panel this is, when the host has more than one. |
| `viewerId` | `string` |  | Force a specific registered viewer. |
| `mode` | `'view' \| 'edit'` |  |  |
| `viewerProps` | `Record<string, unknown>` |  | Props for whichever component the registry picks. The caller does not know which component that is - that is the point of the registry - but it may still have something to say to it, like "you are why the mode changed, so take focus". |
| `autoFocus` | `boolean` |  |  |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

The entry point to the whole resource system: give it a URI and it resolves the provider, reads the resource, asks the viewer registry what opens that kind and renders it.

`viewerId` pins one instead - what a screen passes after the reader has chosen from [`ResourceOpenWith`](resource-open-with.md). `mode="edit"` asks for an editor rather than a viewer where one is registered.

`uri` accepts `null` so a pane can render its own empty state while nothing is open.

## See also

- [Documents](../../documents/) - providers, adapters and viewers
- [ResourceExplorer](resource-explorer.md) - choosing what to open
- [ResourceOpenWith](resource-open-with.md) - choosing how
