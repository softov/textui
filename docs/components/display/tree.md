---
title: Tree
parent: Display and data
grand_parent: Components
---

# Tree
{: .no_toc }

Rows that nest, expand and collapse.

```tsx
import { Tree } from '@textui/widgets';

<Tree
  nodes={[
    { id: 'src', label: 'src', children: [{ id: 'app', label: 'app.tsx' }] },
  ]}
  expandedIds={['src']}
  onToggle={(id, expanded) => console.log(id, expanded)}
/>
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `nodes` | `TreeNode[]` | **required** |  |
| `selectedId` | `string` |  |  |
| `expandedIds` | `string[]` |  |  |
| `onSelect` | `(id: string, node: TreeNode) => void` |  |  |
| `onActivate` | `(id: string, node: TreeNode) => void` |  |  |
| `onToggle` | `(id: string, expanded: boolean) => void` |  |  |
| `visibleRows` | `number` |  |  |
| `indent` | `number` | `2` |  |
| `twistyOpen` | `string` |  | What the expand mark looks like, when a chevron is not what it means. A file tree's twisty is not only "there is more here" - it is also the one thing on the row that says this is a folder, because a folder has no size beside it and nothing else distinguishes it. A caller that knows its rows are folders can say so; everything else gets the theme's chevrons. |
| `twistyClosed` | `string` |  |  |
| `autoFocus` | `boolean` |  | Claim focus on mount, if nothing in this scope already has it. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Role: `tree`.

`expandedIds` is a controlled list, so what is open lives wherever you keep
it and survives the tree being unmounted. `hasChildren` marks a node as
expandable before its children are known, which is what a lazily-loaded
directory needs to draw an arrow at all.

`indent` is in cells per level, and two is usually right in a terminal - four
runs out of width three levels down.

## See also

- [List](list.md) - the flat version
- [ResourceExplorer](../surfaces/resource-explorer.md) - a tree over a resource provider
