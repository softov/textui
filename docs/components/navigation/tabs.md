---
title: Tabs
parent: Navigation and overlays
grand_parent: Components
---

# Tabs
{: .no_toc }

One of several views, chosen from a row of labels.

```tsx
import { Tabs } from '@textui/widgets';

<Tabs
  items={[
    { id: 'logs', label: 'Logs' },
    { id: 'metrics', label: 'Metrics', badge: 3 },
  ]}
  activeId="logs"
  onChange={(id) => console.log(id)}
/>
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `items` | `TabItem[]` | **required** |  |
| `activeId` | `string` |  |  |
| `onChange` | `(id: string) => void` |  |  |
| `variant` | `'underline' \| 'solid' \| 'plain'` | `'underline'` | Underline the active tab instead of inverting it. |
| `separator` | `string` |  |  |
| `autoFocus` | `boolean` |  | Take focus on mount, so the keyboard has somewhere to be. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Role: `tablist`.

Tabs draw the strip and report the choice; they do not hold the panels. What is below them is the screen's business, which is what lets the same strip drive a surface, a router or a plain conditional.

For panels that are *mounts* rather than markup, the surface system already has this: [`TabsLayout`](../surfaces/tabs-layout.md) arranges a surface's mounts as tabs and needs no strip of your own.

`badge` puts a count on a tab, which is the usual reason a reader looks at one they were not already on.

## See also

- [TabsLayout](../surfaces/tabs-layout.md) - the same idea over surface mounts
- [Breadcrumb](breadcrumb.md) - depth rather than siblings
