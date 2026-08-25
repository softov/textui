---
title: PathPicker
parent: Navigation and overlays
grand_parent: Components
---

<!-- docs:setup
declare const open: (uri: string) => void; declare const close: () => void; -->

# PathPicker
{: .no_toc }

Pick a file or a folder by walking to it.

```tsx
import { PathPicker } from '@textui/widgets';

<PathPicker
  start="file:///home/you/project"
  wants="file"
  title="Open a file"
  onPick={(uri) => open(uri)}
  onCancel={() => close()}
/>
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `start` | `string` | **required** |  |
| `wants` | `'file' \| 'directory'` | `'file'` |  |
| `title` | `string` |  |  |
| `placeholder` | `string` |  |  |
| `visibleRows` | `number` | `10` |  |
| `onPick` | `(uri: string) => void` |  |  |
| `onCancel` | `() => void` |  |  |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Role: `dialog`.

The picker walks the **resource registry**, never the filesystem, so it browses whatever is mounted rather than `file:` alone - the first thing anyone wants to pick off a remote is a file.

Typing filters the visible rows. `enter` on a folder goes into it, and `left` at the start of the filter goes back up: the field answers arrow keys itself, so it hands the edges back through `onEdge` rather than swallowing them.

`wants: 'directory'` adds a "Use this folder" row, because when the answer is the place you are standing there is no child to press enter on.

Most callers want [`pick()`](../../platform/layers.md) instead, which opens this in a layer and returns a promise.

## See also

- [Menu](menu.md) - the list this is built on
- [CommandPalette](command-palette.md) - the same filter-and-choose shape, over commands
