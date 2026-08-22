---
title: Viewers, editors and actions
parent: Documents
nav_order: 2
---

<!-- docs:setup
declare const app: import('@textui/core').TextUIApp;
-->

# Viewers, editors and actions

What the registry offers for a kind, and the order it picks among them.

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
  run: (args, ctx) => void ctx.app.execute('file.delete', { uri: String(args.uri) }),
});
```

An action's `run` reaches the world through `ctx.app`. Note what the registry
itself forwards: `stat`, `list`, `read` and `write`, and nothing else. A
provider may also implement `delete`, `rename` and `watch`, but there is no
registry passthrough for those, so an action needing one has to go through a
command the host registered - which is what the delete above does.

Selection order: an explicit `viewerId`, then an editor when edit was asked for,
then the best-priority viewer for the kind or an ancestor, then a fallback
viewer, then any component that declared `opens` for the kind.

A component can declare that it opens a kind, which is how the shipped viewers
work without an application registering anything:

<!-- docs:nocheck -->
```ts
{
  component: 'MarkdownViewer',
  opens: { resourceKinds: ['file.markdown'], title: 'Markdown', priority: 50 },
  renderer: { kind: 'function', render: MarkdownViewer },
}
```
