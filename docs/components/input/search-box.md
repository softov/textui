---
title: SearchBox
parent: Controls and forms
grand_parent: Components
---

# SearchBox
{: .no_toc }

A text input with a search glyph and a result count.

```tsx
import { SearchBox } from '@textui/widgets';

<SearchBox value="" count={12} onChange={(value) => console.log(value)} />
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `count` | `number` |  | Result count, shown after the field. |
<!-- props:end -->

Role: `searchbox`.

Everything [`TextInput`](text-input.md) takes except `search`, which is already on. `count` prints the number of matches in the field, which is the one piece of feedback a filter needs and the one most often left to a label somewhere else.

Filtering is not its job. It reports what was typed; what that matches is the screen's business.

## See also

- [TextInput](text-input.md) - the full prop list
- [List](../display/list.md), [Table](../display/table.md) - what a search box usually filters
