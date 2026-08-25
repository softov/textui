---
title: StatusDot
parent: Display and data
grand_parent: Components
---

# StatusDot
{: .no_toc }

The shared status vocabulary: a glyph and a colour, never only a colour.

```tsx
import { StatusDot } from '@textui/widgets';

<StatusDot status="degraded" label="billing-worker" />
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `status` | `'up' \| 'down' \| 'degraded' \| 'unknown' \| 'pending'` | **required** |  |
| `label` | `string` |  |  |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Role: `status`.

Five states, and they are fixed: `up`, `down`, `degraded`, `unknown`, `pending`. Fixing them is the point - a status that means the same thing everywhere can be read at a glance, and one invented per screen cannot.

Each is **a glyph and a colour**, not a colour. A sixteen-colour session, a colourblind reader and a piped log all lose the colour and keep the glyph, so the glyph has to carry the meaning on its own.

## See also

- [Badge](badge.md) - free text rather than a fixed vocabulary
- [Alert](alert.md) - a state worth a whole row
- [Capabilities](../../terminal/capabilities.md) - what a 16-colour session loses
