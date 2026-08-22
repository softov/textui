---
title: ErrorState
parent: Display and data
grand_parent: Components
---

# ErrorState
{: .no_toc }

Something threw, and here is what and whether to retry.

```tsx
import { ErrorState } from '@textui/core';

<ErrorState error={new Error('connection refused')} onRetry={() => {}} />
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `title` | `string` | `'Something went wrong'` |  |
| `error` | `unknown` | **required** |  |
| `onRetry` | `() => void` |  | Command id offered as a retry. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Role: `alert`.

`error` is `unknown` on purpose: what a `catch` gives you is not always an
`Error`, and a component that demanded one would push a type assertion into
every call site. It renders what it can from whatever it is handed.

`onRetry` draws a retry button when given and nothing when not, so a failure
with no recovery does not offer one.

This is also what a component boundary renders when a subtree throws - see
[When one throws](../errors.md).

## See also

- [When one throws](../errors.md) - fallbacks and boundaries
- [Alert](alert.md) - a warning that is not a failed region
- [EmptyState](empty-state.md) - nothing to show, but nothing wrong
