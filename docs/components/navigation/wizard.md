---
title: Wizard
parent: Navigation and overlays
grand_parent: Components
---

# Wizard
{: .no_toc }

Numbered steps, with the ones behind you marked done.

```tsx
import { Wizard } from '@textui/widgets';

<Wizard
  steps={[
    { id: 'source', label: 'Source' },
    { id: 'review', label: 'Review' },
  ]}
  activeId="review"
  completedIds={['source']}
/>
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `steps` | `WizardStep[]` | **required** |  |
| `activeId` | `string` | **required** |  |
| `completedIds` | `string[]` | `[]` | Steps already completed. |
| `orientation` | `'horizontal' \| 'vertical'` | `'horizontal'` |  |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

The indicator only. It shows where you are in a sequence; it holds no step
content and enforces no order, so the screen decides what a step contains and
whether you may skip one.

`orientation="vertical"` runs it down the side, which fits a narrow terminal
better once there are more than about four steps.

## See also

- [Tabs](tabs.md) - when the order does not matter
- [Form](../input/form.md) - what a step usually holds
