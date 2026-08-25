---
title: Select
parent: Controls and forms
grand_parent: Components
---

# Select
{: .no_toc }

One of several, collapsed into a row until opened.

```tsx
import { Select } from '@textui/widgets';

<Select
  label="Region"
  options={[
    { value: 'eu-west-1', label: 'eu-west-1' },
    { value: 'us-east-1', label: 'us-east-1' },
  ]}
  value="eu-west-1"
  onChange={(value) => console.log(value)}
/>
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `options` | `SelectOption[]` | **required** |  |
| `value` | `string` |  |  |
| `onChange` | `(value: string) => void` |  |  |
| `label` | `string` |  |  |
| `placeholder` | `string` |  |  |
| `open` | `boolean` |  | Show the list inline instead of collapsing to one line. |
| `visibleRows` | `number` | `6` | Rows shown at once when open. |
| `mode` | `'inline' \| 'floating' \| 'modal'` | `'inline'` | Where the list goes when it opens. `inline` grows the control: the options appear inside the same border, and everything under it moves down. Honest about the space it takes and the only one that cannot be clipped, which is why it is the default. `floating` puts the list on the floating layer, anchored under the control. Nothing below it moves, which is what you want in a form or a dense row of controls - the layout does not jump as you open and shut it. `modal` puts it in the middle of the screen over a scrim. For a list long enough or a choice consequential enough that the rest of the screen is a distraction. The keys are the same in all three, because the control keeps the keyboard in all three: the layer is somewhere to *draw* the list, not somewhere the focus goes. Arrow keys, enter and escape are answered by the same handler whichever mode it is in. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Role: `combobox`.

Closed it is one row; open it is a panel on the floating [layer](../../platform/layers.md), so it draws over what is beneath it instead of pushing the form down.

`open` makes that controlled, for a screen that wants to open the list from a command. `visibleRows` caps the panel and the rest scrolls.

## See also

- [RadioGroup](radio-group.md) - when there are few enough to show at once
- [CommandPalette](../navigation/command-palette.md) - searching commands rather than choosing a value
