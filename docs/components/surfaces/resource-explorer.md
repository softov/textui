---
title: ResourceExplorer
parent: Surfaces, shells and resources
grand_parent: Components
---

# ResourceExplorer
{: .no_toc }

A tree over a resource provider.

```tsx
import { ResourceExplorer } from '@textui/documents';

<ResourceExplorer root="file:///srv" onOpen={(resource) => console.log(resource.uri)} />
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `root` | `string` | **required** | Root URI to browse. |
| `onOpen` | `(resource: Resource) => void` |  | Called when a resource is activated - enter, or a double click. |
| `onSelect` | `(resource: Resource) => void` |  | Called as the selection moves, before anything is opened. |
| `selectedUri` | `string` |  |  |
| `visibleRows` | `number` |  |  |
| `folderIcons` | `{ folder: string; folderOpen: string }` |  | What a folder looks like, open and shut. The tree draws a chevron by default, which says whether a row is expanded and nothing about what kind of row it is. An application with its own icon vocabulary - textide has one - says which marks mean folder here, rather than this file growing an opinion about glyphs it cannot pick for every terminal. |
| `autoFocus` | `boolean` |  | Claim focus on mount, so an application has somewhere to start. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Lists children lazily through the provider for `root`, so a directory is read
when it is expanded rather than up front.

`onSelect` fires as the cursor moves and `onOpen` on enter - the same split
[`List`](../display/list.md) makes, and for the same reason: a preview pane
should follow the cursor, and opening should not.

## See also

- [ResourceView](resource-view.md) - rendering what was opened
- [Tree](../display/tree.md) - the control underneath
- [Providers](../../documents/providers.md)
