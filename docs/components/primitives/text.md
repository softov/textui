---
title: text
parent: The four primitives
grand_parent: Components
---

# text
{: .no_toc }

A run of text. Wraps, truncates and aligns within the box it is given.

```tsx
<text content="billing-worker" fg="accent" bold />
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `children` | `unknown` |  |  |
| `content` | `string` |  | The string to draw. `children` is accepted as a shorthand. |
| `truncate` | `'end' \| 'start' \| 'middle' \| false` |  | Where to cut when the text does not fit. |
| `ellipsis` | `string` |  |  |
| `match` | `string` |  | Text to pick out wherever it appears, case-insensitively. For search: the caller passes what it is looking for and the rows are coloured where they hold it. It is applied after wrapping and truncation, to the text as drawn - so nothing about how a paragraph is broken into lines has to change to mark a hit in it, and a match split across a wrap is simply not on either row to colour. |
| `matchFg` | `StyleColor` |  | The match's colours. Accent on its own foreground by default. |
| `matchBg` | `StyleColor` |  |  |

Plus everything on [`BaseProps`](../base-props.md).
<!-- props:end -->

`content` and children are the same thing - `<text>hello</text>` and `<text content="hello" />` produce the same node. Prefer `content` when the string is computed, because it survives being written as data.

Text does not size itself; the box around it decides the width, and `wrap` and `truncate` decide what happens when the string is longer than that:

```tsx
<box width={20}>
  <text content="a service name far too long for this column" truncate="middle" />
</box>
```

`truncate` takes `'start'`, `'middle'`, `'end'` or `false`, and `ellipsis` replaces the character used to mark the cut.

## See also

- [Heading](../display/heading.md), [Label](../display/label.md) - text with a role and a theme tone
- [Base props](../base-props.md) - `wrap`, `textAlign` and the other style keys
