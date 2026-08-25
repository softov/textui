---
title: Tooltip
parent: Navigation and overlays
grand_parent: Components
---

# Tooltip
{: .no_toc }

A short label attached to whatever it wraps.

```tsx
import { Tooltip } from '@textui/widgets';

<Tooltip text="Restarts every worker">
  <text content="Restart all" />
</Tooltip>
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `text` | `string` | **required** |  |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Role: `tooltip`.

A terminal has no hover for most inputs, so this shows on focus rather than on pointer - which means it only ever appears on something focusable.

That makes it weaker than a tooltip on the web, and a [`KeyHints`](key-hints.md) line or a `description` prop is often the better answer.

## See also

- [KeyHints](key-hints.md) - discoverability that does not need focus
- [Base props](../base-props.md) - the `description` prop
