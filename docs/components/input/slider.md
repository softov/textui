---
title: Slider
parent: Controls and forms
grand_parent: Components
---

# Slider
{: .no_toc }

A number in a range, moved with the arrow keys.

```tsx
import { Slider } from '@textui/widgets';

<Slider label="Volume" value={40} onChange={(value) => console.log(value)} />
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `value` | `number` | **required** |  |
| `min` | `number` | `0` |  |
| `max` | `number` | `100` |  |
| `step` | `number` | `1` |  |
| `label` | `string` |  |  |
| `onChange` | `(value: number) => void` |  |  |
| `trackWidth` | `number` | `20` | Cells the track occupies. |
| `format` | `(value: number) => string` |  |  |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Role: `slider`.

Left and right move by `step`. `format` renders the number beside the track,
which is where a unit goes - `${value}ms` reads and `420` does not.

A terminal slider is coarse: `trackWidth` cells for the whole range, so 20
cells over 0-100 moves in visible jumps of five. Where the exact number matters
more than the sense of a range, a [`TextInput`](text-input.md) is honest and a
slider is not.

## See also

- [Progress](../display/progress.md) - reporting a value rather than setting one
- [TextInput](text-input.md) - when the precise number matters
