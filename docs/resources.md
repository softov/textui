# Resources

A resource is anything addressable that a viewer, an editor or an action can be registered for - a file, a record, a log stream, a service. The filesystem is one provider among several rather than the model itself, which is what lets an explorer browse services and files with the same component.

The point of the whole design: **nothing that displays a resource names a viewer.** An explorer browses URIs, the registry decides what opens the kind, and adding a viewer for a new kind makes every screen understand it at once.

## Kinds

Kinds form a hierarchy by dotted name, so a viewer registered for `file.text` still opens a `.rs` file when nothing more specific exists.

```ts
app.resources.registerKind({ id: 'file', title: 'File' });
app.resources.registerKind({ id: 'file.text', title: 'Text', extends: 'file', extensions: ['*.txt'] });
app.resources.registerKind({ id: 'file.markdown', title: 'Markdown', extends: 'file.text', extensions: ['*.md'] });
app.resources.registerKind({
  id: 'directory',
  title: 'Directory',
  // Extensions cannot answer this; only the provider knows.
  detect: (uri, meta) => meta.size === undefined,
});
```

Classification is extension, then MIME type, then an explicit `detect`, with a more specific kind beating its parent on equal evidence.

## Providers

One per URI scheme.

```ts
app.resources.registerProvider({
  scheme: 'service',
  async stat(uri) {
    const service = await lookup(uri);
    return service && {
      uri,
      kind: 'service',
      metadata: { name: service.name },
      capabilities: ['read', 'watch'],
    };
  },
  async list(uri) { … },
  async read(uri) { … },
  async write(uri, content) { … },
});
```

A provider may return `kind: 'unknown'` and leave classification to the registry, which keeps the rules in one place.

## Viewers, editors and actions

```ts
app.resources.registerViewer({
  id: 'markdown', title: 'Markdown', kinds: ['file.markdown'],
  component: 'MarkdownViewer', priority: 100,
});

app.resources.registerViewer({
  id: 'unknown', title: 'Details', kinds: [],
  component: 'FallbackViewer', fallback: true,
});

app.resources.registerEditor({
  id: 'text-edit', title: 'Edit', kinds: ['file.text'],
  component: 'TextEditor', saves: true,
});

app.resources.registerAction({
  id: 'file.delete', title: 'Delete', kinds: ['file'],
  slots: ['context'],
  run: (args, ctx) => ctx.app.resources.delete?.(String(args.uri)),
});
```

Selection order: an explicit `viewerId`, then an editor when edit was asked for, then the best-priority viewer for the kind or an ancestor, then a fallback viewer, then any component that declared `opens` for the kind.

A component can declare that it opens a kind, which is how the shipped viewers work without an application registering anything:

```ts
{
  component: 'MarkdownViewer',
  opens: { resourceKinds: ['file.markdown'], title: 'Markdown', priority: 50 },
  renderer: { kind: 'function', render: MarkdownViewer },
}
```

## Adapters

Everything one resource type needs, registered as one value. The registries underneath stay separate - an adapter is a convenience for the author and a unit of undo for the application, not a new mechanism.

```ts
import { jsonAdapter } from '@textui/core';

const registration = app.registerAdapter(jsonAdapter());
// ...
registration.dispose();   // removes exactly what it added
```

`ResourceAdapter` carries `kinds`, `providers`, `components`, `highlighters`, `viewers`, `editors`, `actions`, `commands` and `keybindings`, plus a `register(app)` escape hatch for anything the fields cannot express. They are registered in that order, so a viewer always has its kind to match against.

The JSON adapter shipped in `@textui/core/adapters` is the worked example:

```ts
{
  id: 'json',
  kinds: [{ id: 'file.data.json', extends: 'file.data', extensions: ['*.json'] }],
  highlighters: [jsonHighlighter],
  viewers: [
    { id: 'json.source', title: 'Source', component: 'JsonViewer', priority: 120 },
    { id: 'json.tree', title: 'Structure', component: 'JsonTreeViewer', priority: 110 },
  ],
  actions: [/* format, minify, sort keys, validate */],
  commands: [/* the same three, for the palette */],
}
```

Nothing is registered by default. An adapter is a decision - that `.json` means this kind, these viewers and these transforms - and decisions belong to the application.

Two viewers for one kind is the point of `viewersFor(kind)`: it is what makes "open with" a real choice, and what a screen offers when it lets you pick.

## Documents

An action that formats a file has to change something. Changing the provider means every transform is a write; changing nothing means the transform is a lie. A **document buffer** is the third option.

```ts
import { openDocument, setDocumentContent, saveDocument, isDocumentDirty } from '@textui/core';

const doc = await openDocument(app, uri);      // reads through the provider, once
setDocumentContent(app.store, uri, formatted); // every viewer of that URI updates
isDocumentDirty(app.store, uri);               // content !== what was read
await saveDocument(app, uri);                  // writes back, or throws if read-only
```

In a component:

```tsx
const doc = useDocument(uri);
doc.content; doc.dirty; doc.readonly;
doc.set(next); doc.revert(); doc.reload(); await doc.save();
```

Buffers live at `$/session/documents/<uri>`, so they die with the process. The viewers shipped here read them, which is why running "Format" on a file from a read-only provider shows you the formatted document and changes nothing on disk.

## Opening one

```ts
await app.openResource('file:///notes/todo.md');                   // into `main`
await app.openResource(uri, { surface: 'aside', mode: 'edit' });
```

The caller never names a component.

## The worked example

`playground/src/examples/` is the filesystem explorer the brief asks for: a real provider over `node:fs`, kinds for text, markdown, code and data, viewers for each, a fallback for everything else, registered actions, and the JSON adapter on top. Read `explorer.tsx` and note what is *not* imported - there is no `MarkdownViewer` in it, no `JsonViewer`, and no `if (ext === '.md')`.

It also shows the two rules that keep a viewer from wrecking a layout: every pane is a fixed size or a flex share, and the viewer scrolls inside its pane. Opening a four-line file and a four-thousand-line one produce the same frame - there is a test that asserts exactly that.

Run it:

```bash
pnpm dev explorer
```
