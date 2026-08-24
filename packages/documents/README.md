# @textui/documents

Text buffers with undo, and the viewers that put a resource on the screen.

```bash
npm install @textui/documents
```

## Documents

An open file is state in the store, not an object somebody has to hold. Keyed by
URI, so any component can ask whether the thing it is showing has unsaved
changes without being handed a reference to it.

```ts
import { openDocument, setDocumentContent, isDocumentDirty } from '@textui/documents';

// Reads through the resource registry, or hands back the buffer already open.
await openDocument(app, 'file:///notes.md');
setDocumentContent(app.store, 'file:///notes.md', next);
isDocumentDirty(app.store, 'file:///notes.md');   // true
```

Reading takes the app, because it goes through the resource registry to get
there. Everything after that takes the store, because by then the document is
just state. `undoDocument` / `redoDocument` walk a per-document history, and
`useDocument(uri)` is the hook a component uses.

## Viewers

`ResourceView` opens a URI with whatever viewer the resource registry has for
its kind, and `ResourceExplorer` browses a tree of them. Neither knows what a
file is: they go through the registry, so a viewer registered for `git:diff/…`
opens in the same pane as one registered for `file:`.

| | |
|---|---|
| `ResourceView` | Opens a URI with the registered viewer for its kind |
| `ResourceExplorer` | The tree, with the icon and tone the opener declares |
| `ResourceOpenWith` | The other viewers that offered, so you can pick one |
| `CodeEditor` | The editable one: caret, selection, gutter marks |
| `jsonAdapter` | Coloured source, a structure view, and Format / Minify / Sort / Validate |

## Runtime

Depends on `@textui/core` and `@textui/widgets`. No `node:` imports - a document
is a string and a URI, and where it came from is the provider's problem. Node
22+ and Bun.

## Documentation

<https://softov.github.io/textui/>
