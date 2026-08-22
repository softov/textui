---
title: canvas
parent: The four primitives
grand_parent: Components
---

<!-- docs:setup
import type { PaintSurface, RenderContext } from '@textui/core';
-->

# canvas
{: .no_toc }

Direct cell painting. The escape hatch, and the only primitive the layout engine cannot reason about.

```tsx
<canvas
  intrinsic={{ height: 1 }}
  draw={(surface: PaintSurface, ctx: RenderContext) => {
    surface.fill(undefined, '\u2500', { fg: ctx.color('muted') });
  }}
/>
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `draw` | `(surface: PaintSurface, ctx: RenderContext) => void` | **required** | Paint directly. The escape hatch charts and gauges use; everything else should compose `box` and `text` so the layout engine can reason about it. |
| `intrinsic` | `{ width?: number; height?: number }` |  | Intrinsic size when the style does not fix one. |

Plus everything on [`BaseProps`](../base-props.md).
<!-- props:end -->

`draw` receives a [`PaintSurface`](https://github.com/softov/textui) clipped
to the node's own rectangle - `put`, `text`, `fill`, `cell` and `clip` -
and a render context carrying the resolved theme, the terminal's capabilities
and the node's focus state.

Reach for it only when the thing being drawn is not made of boxes and text.
Every chart in the catalog is a canvas; almost nothing else should be, because
a canvas is opaque to layout, to the test harness's semantic queries, and to
anything that wants to know what is on screen.

`intrinsic` is the size to take when the style does not fix one.

## See also

- [Sparkline](../display/sparkline.md), [Gauge](../display/gauge.md) - canvases worth reading before writing one
- [Writing a component](../writing.md) - composing `box` and `text` instead
