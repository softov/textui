---
title: Badge
parent: Display and data
grand_parent: Components
---

# Badge
{: .no_toc }

A short inline tag - a count, a state, a version.

```tsx
import { Badge } from '@textui/widgets';

<Badge label="running" tone="success" />
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `label` | `string` | **required** |  |
| `tone` | `'default' \| 'primary' \| 'secondary' \| 'accent' \| 'success' \| 'warning' \| 'danger' \| 'info' \| 'muted'` | `'default'` |  |
| `variant` | `'solid' \| 'outline' \| 'ghost' \| 'link'` | `'ghost'` |  |
| `icon` | `string` |  | Glyph before the label, so the badge reads without colour. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

A badge is inline and stays one row, which is why its `outline` variant is
brackets rather than a box: a drawn frame would make it three rows and it would
stop sitting inside a line of text.

Otherwise it shares [`Button`](../input/button.md)'s vocabulary - the same
`tone` scale, the same `variant` names - because a reader should not have to
learn two.

## See also

- [StatusDot](status-dot.md) - a state as a glyph, which survives losing colour
- [Button](../input/button.md) - the same tones, but focusable
