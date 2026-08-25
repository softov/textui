---
title: Base props
parent: Components
nav_order: 2
---

<!-- docs:setup
declare const app: import('@textui/core').TextUIApp; -->

# Base props
{: .no_toc }

Every node accepts these, whatever component it names. A component page lists what that component adds; this is the set underneath all of them.

```tsx
import { Panel } from '@textui/widgets';

<Panel
  title="Services"
  padding={1}
  gap={1}
  border="single"
  focusable
  label="service list"
  onKey={(event) => event.name === 'r' && void app.execute('services.refresh')}
/>
```

Four things are worth knowing before the tables.

## Style arrives three ways

The same declaration can be written inline, as an object, or as a stateful map, and they compose rather than compete:

```tsx
<>
  <box gap={1} padding={1} border="single" />
  <box style={{ gap: 1, padding: 1 }} />
  <box style={{ base: { fg: 'muted' }, focus: { fg: 'accent', bold: true } }} />
</>
```

Inline keys are the convenience form for the common case. Reach for `style` when a value is stateful - `base` / `focus` / `disabled` - or when it is computed and passing twenty props would be worse than passing one object.

## `label` and `role` are not decoration

They are what the test harness queries by, and what future accessibility work will read. A node with an interactive `role` is focusable without saying so:

```tsx
<box role="button" label="Restart the server" onClick={() => {}} />
```

That is a working button - focusable, in the tab order, named - without importing `Button`. `Button` exists because it also draws a ring, states a tone, and inverts when focused.

## `onKey` normally needs focus

A handler runs while its node is focused. `global` opts out of that, for a node that wants the keys its children decline:

```tsx
<box global onKey={(event) => event.name === 'escape'} />
```

Use it for a wrapper - a dropdown taking left and right while the menu inside keeps up and down. Everywhere else, focus is what decides who gets a key, and `global` throws that away.

## `breakpoints` are per node, not per screen

A node renders `compact` below the first width and `minimal` below the second. The widths are its own, not the terminal's, so a panel in a narrow column degrades while the same component in the main pane does not.

## The tables

<!-- props:start -->

### BaseProps

Props every node accepts. Style arrives three ways on purpose: the full `style` object for anything stateful, a merged list for composition, and the individual style keys inline as convenience props - `<box gap={1} border="single">` rather than `<box style={{ gap: 1, border: 'single' }}>` for the common case.

| Prop | Type | |
| --- | --- | --- |
| `id` | `string` |  |
| `key` | `string \| number` |  |
| `style` | `StyleInput` |  |
| `role` | `SemanticRole` | Semantic metadata. Drives the test harness, and future a11y work. |
| `label` | `string` |  |
| `description` | `string` |  |
| `disabled` | `boolean` |  |
| `selected` | `boolean` |  |
| `focusable` | `boolean` | Participates in tab order. Implied by an interactive role. |
| `focusScope` | `string` | The focus scope this node belongs to. |
| `autoFocus` | `boolean` |  |
| `global` | `boolean` | `onKey` runs whether or not this node is focused. For a node that wraps something else and wants the keys that thing declines - a dropdown panel taking left and right while the menu inside it keeps up and down. Without this a handler only runs while focused, which is what focus means. |
| `onKey` | `(event: KeyEvent) => boolean \| void` |  |
| `onFocus` | `() => void` |  |
| `onBlur` | `() => void` |  |
| `onMouse` | `(event: MouseEvent) => boolean \| void` | Every mouse action on this node, innermost first. Returning `true` stops it going any further - and on a `down`, **claims the rest of the gesture**: the `drag`s and the `up` that follow come here whatever they are over, until the button comes back up. Dispatch is otherwise a hit test, so without that a drag would stop at the edge of the node it started in, which is where a drag starts being worth having. |
| `onClick` | `Action \| ((event: MouseEvent) => void)` | The left button going down - a third of a gesture. `onMouse` for the rest. |
| `onHover` | `(hovering: boolean) => void` | The pointer entered or left this node. Called once each way, not per cell. Hover is inherited the way it is in a browser: a row is hovered while the pointer is over the label inside it, because the label is what a hit test finds. A `style` with a `hover` overlay needs nothing else - this is for the cases where something other than a colour has to happen. |
| `link` | `string` | OSC 8 link target, where the terminal supports hyperlinks. |
| `breakpoints` | `{ compact?: number; minimal?: number }` | Below this width the node renders `compact`; below that, `minimal`. |

### BoxProps

| Prop | Type | |
| --- | --- | --- |
| `children` | `unknown` |  |
| `title` | `string` | Header text drawn into the top border. Needs a border to land on. |
| `titleAlign` | `'left' \| 'center' \| 'right'` |  |
| `rightTitle` | `string` | A second label on the top border, hard against the right. For the short thing that belongs beside a heading rather than under it - a count, a shortcut, a state. It takes its space first and `title` gets what is left, so the two never collide and the title is the one that truncates. |
| `footer` | `string` | Footer text drawn into the bottom border. |
| `footerAlign` | `'left' \| 'center' \| 'right'` |  |
| `scrollTop` | `number` | Scroll offset in cells, when overflow is 'scroll'. |
| `scrollLeft` | `number` |  |

### TextProps

| Prop | Type | |
| --- | --- | --- |
| `children` | `unknown` |  |
| `content` | `string` | The string to draw. `children` is accepted as a shorthand. |
| `truncate` | `'end' \| 'start' \| 'middle' \| false` | Where to cut when the text does not fit. |
| `ellipsis` | `string` |  |

### CanvasProps

| Prop | Type | |
| --- | --- | --- |
| `draw` | `(surface: PaintSurface, ctx: RenderContext) => void` | Paint directly. The escape hatch charts and gauges use; everything else should compose `box` and `text` so the layout engine can reason about it. |
| `intrinsic` | `{ width?: number; height?: number }` | Intrinsic size when the style does not fix one. |

### SpacerProps

| Prop | Type | |
| --- | --- | --- |
| `size` | `number` | Cells to take. Unset means "take whatever is left", the same as `flex: 1`. |
<!-- props:end -->
