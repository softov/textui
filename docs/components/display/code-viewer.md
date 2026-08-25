---
title: CodeViewer
parent: Display and data
grand_parent: Components
---

# CodeViewer
{: .no_toc }

A viewport over source, highlighted by the registry and scrolled by lines.

```tsx
import { CodeViewer } from '@textui/widgets';

<CodeViewer content={'const x = 1;\nconst y = 2;\n'} language="ts" flex={1} />
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `content` | `string` | **required** |  |
| `lineNumbers` | `boolean` | `true` | Show line numbers in a gutter. |
| `startLine` | `number` | `1` |  |
| `visibleRows` | `number` |  | Fix the number of rows. Left off, the viewer renders exactly as many rows as it was laid out into - which is what stops a long file from resizing the pane it is shown in. |
| `highlight` | `number[]` | `[]` | Rows to mark, 1-based. |
| `tokens` | `SyntaxToken[][]` |  | Pre-tokenised content, when the caller has already highlighted it. |
| `language` | `string` |  | Ask the registry for a highlighter by id... |
| `kind` | `string` |  | ...or by resource kind... |
| `uri` | `string` |  | ...or by filename. |
| `line` | `number` |  | Caret line, 1-based. Controlled when passed. |
| `onLineChange` | `(line: number) => void` |  |  |
| `onPosition` | `(position: CodeViewerPosition) => void` |  | Called whenever the caret or the viewport moves. |
| `scrollbar` | `boolean` | `true` | Draw a scrollbar when the content is taller than the view. |
| `showCaret` | `boolean` | `true` | Mark the caret line. Off for a plain excerpt. |
| `tabWidth` | `number` | `4` |  |
| `autoFocus` | `boolean` |  | Take the keyboard on mount. Wanted by a viewer that is the only thing in a dialog: a modal traps focus but does not hand it to anything, so a scrollable body nobody focused is a body nobody can scroll. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Role: `document`.

A viewport, not a column of lines: it renders the rows it was laid out into, slices each one to the visible columns rather than claiming the width of the longest, and expands tabs to real tab stops. **Opening a ten-thousand-line file costs what opening a ten-line one costs.**

Colour comes from asking the highlighter registry what opens the `kind` it was given; pass `tokens` directly to bypass that and highlight it yourself.

`line` and `onLineChange` hold the cursor, and `onPosition` reports line and column together for a status bar.

## See also

- [Syntax highlighting](../../themes/syntax.md) - what the registry resolves
- [CodeEditor](../surfaces/code-editor.md) - the same viewport, writable
- [ScrollView](../layout/scroll-view.md) - scrolling cells rather than lines
