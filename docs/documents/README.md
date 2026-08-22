---
title: Documents
nav_order: 10
has_children: true
permalink: /documents/
---

<!-- docs:setup
declare const app: import('@textui/core').TextUIApp;
-->

# Documents

A resource is anything addressable that a viewer, an editor or an action can be
registered for - a file, a record, a log stream, a service. The filesystem is one
provider among several rather than the model itself, which is what lets an
explorer browse services and files with the same component.

The point of the whole design: **nothing that displays a resource names a
viewer.** An explorer browses URIs, the registry decides what opens the kind, and
adding a viewer for a new kind makes every screen understand it at once.

## Kinds

Kinds form a hierarchy by dotted name, so a viewer registered for `file.text`
still opens a `.rs` file when nothing more specific exists.

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

Classification is extension, then MIME type, then an explicit `detect`, with a
more specific kind beating its parent on equal evidence.
