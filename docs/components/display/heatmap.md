---
title: Heatmap
parent: Display and data
grand_parent: Components
---

# Heatmap
{: .no_toc }

A grid of values, coloured by intensity.

```tsx
import { Heatmap } from '@textui/widgets';

<Heatmap
  data={[[1, 4, 9], [3, 3, 2]]}
  rowLabels={['api', 'worker']}
  columnLabels={['mon', 'tue', 'wed']}
/>
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `data` | `number[][]` | **required** | Rows of values. All rows should be the same length. |
| `min` | `number` |  |  |
| `max` | `number` |  |  |
| `rowLabels` | `string[]` |  |  |
| `columnLabels` | `string[]` |  |  |
| `ramp` | `readonly string[]` |  | Glyph ramp, lowest to highest. Defaults to the theme's blocks. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

`data` is rows of columns. `ramp` overrides the glyphs used for intensity,
which is the escape hatch for a terminal or a palette where the default does
not separate cleanly.

The usual warning applies harder here than anywhere else in the catalog: on a
sixteen-colour session the ramp has very little to work with, so the default
varies glyph as well as colour.

## See also

- [Histogram](histogram.md) - one axis
- [Glyphs, borders and colour depth](../../themes/downgrade.md) - what degrades
