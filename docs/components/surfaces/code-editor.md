---
title: CodeEditor
parent: Surfaces, shells and resources
grand_parent: Components
---

# CodeEditor
{: .no_toc }

A writable code view, with a cursor, a selection and the clipboard.

```tsx
import { CodeEditor } from '@textui/documents';

<CodeEditor uri="file:///srv/main.ts" onChange={(value) => console.log(value.length)} />
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `uri` | `string \| null` | `null` | The document to edit. Its buffer is the source of truth. |
| `value` | `string` |  | Starting text, for an editor with no document behind it. The buffer is then this component's own: `onChange` reports every edit, but nothing has to be fed back for the next keystroke to be computed against what is actually on screen. |
| `onChange` | `(value: string) => void` |  |  |
| `lineNumbers` | `boolean` | `true` |  |
| `tabWidth` | `number` | `2` | Spaces one indent step is worth. Also what a soft tab inserts. |
| `readonly` | `boolean` |  |  |
| `language` | `string` |  | Ask the syntax registry for a highlighter. |
| `kind` | `string` |  |  |
| `onCursor` | `(cursor: { line: number; column: number }) => void` |  |  |
| `onSelection` | `(selection: { chars: number; lines: number }) => void` |  | Reports how much is selected, for a status bar. Zero means none. |
| `scrollbar` | `boolean` | `true` | Draw a scrollbar when the file is taller than the view. On by default. |
| `autoFocus` | `boolean` |  | Claim focus on mount, if nothing in this scope already has it. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Role: `textbox`.

[`CodeViewer`](../display/code-viewer.md) with editing on top: a real caret, a selection, clipboard integration, and `onChange` for the text.

`onCursor` and `onSelection` report position and selection size for a status bar. `readonly` keeps the caret and the selection while refusing edits, which is what a diff or a preview wants.

Given a `uri` it reads and writes through the document buffer, so dirty state and saving are the buffer's - see [Document buffers](../../documents/buffers.md).

## See also

- [CodeViewer](../display/code-viewer.md) - read-only
- [Document buffers](../../documents/buffers.md) - dirty state and saving
