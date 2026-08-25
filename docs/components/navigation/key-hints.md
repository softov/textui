---
title: KeyHints
parent: Navigation and overlays
grand_parent: Components
---

# KeyHints
{: .no_toc }

The keys available right now, along one line.

```tsx
import { KeyHints } from '@textui/widgets';

<KeyHints hints={[{ keys: 'q', label: 'quit' }, { keys: 'r', label: 'refresh' }]} />
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `hints` | `{ keys: string; label: string }[]` | **required** |  |
| `separator` | `string` |  |  |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

A terminal UI has no menus to discover, so this is usually the only place a reader learns what the keys are. Keep it to the keys that work *here* - a hint line listing everything the application can do teaches nothing.

Commands registered with the `hints` slot can populate this from the registry rather than from a literal, which keeps the line honest as the screen changes.

## See also

- [Commands](../../platform/commands.md) - the `hints` slot
- [StatusBar](status-bar.md) - state rather than available keys
