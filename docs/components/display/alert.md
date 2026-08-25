---
title: Alert
parent: Display and data
grand_parent: Components
---

# Alert
{: .no_toc }

A message worth a row of its own, in one of four tones.

```tsx
import { Alert } from '@textui/widgets';

<Alert tone="warning" title="Degraded" message="Two of six workers are not responding." />
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `tone` | `'info' \| 'success' \| 'warning' \| 'danger'` | `'info'` |  |
| `title` | `string` |  |  |
| `message` | `string` |  |  |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Role: `alert`.

Four tones only - `info`, `success`, `warning`, `danger` - rather than the full semantic scale, because an alert that is `muted` or `secondary` is not an alert.

`title` alone is a single line; adding `message` makes it a block. Children are laid out below both, for an alert that needs an action in it.

## See also

- [ErrorState](error-state.md) - when the whole region failed, not one message
- [Toast](../navigation/toast.md) - a message that leaves on its own
