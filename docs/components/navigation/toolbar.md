---
title: Toolbar
parent: Navigation and overlays
grand_parent: Components
---

# Toolbar
{: .no_toc }

Actions along a row, with optional shortcuts.

```tsx
import { Toolbar } from '@textui/widgets';

<Toolbar
  items={[
    { id: 'run', label: 'Run', shortcut: 'ctrl+r' },
    { id: 'stop', label: 'Stop', disabled: true },
  ]}
  onSelect={(id) => console.log(id)}
/>
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `items` | `{ id: string; label: string; icon?: string; shortcut?: string; disabled?: boolean; tone?: 'default' \| 'primary' \| 'secondary' \| 'accent' \| 'success' \| 'warning' \| 'danger' \| 'info' \| 'muted' }[]` | **required** |  |
| `onSelect` | `(id: string) => void` |  |  |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Role: `toolbar`.

Like [`Menu`](menu.md), `shortcut` is drawn and not registered.

A toolbar is horizontal and space is scarce, so the ids should be [commands](../../platform/commands.md) - the same action then reaches the palette and a chord without a second implementation.

## See also

- [Menu](menu.md) - the same actions, vertically, with submenus
- [Button](../input/button.md) - one action rather than a set
