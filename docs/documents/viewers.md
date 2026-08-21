---
title: Viewers, editors and actions
parent: Documents
nav_order: 2
---

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
  run: (args, ctx) => ctx.app.resources.delete?.(String(args.uri)),
});
```

Selection order: an explicit `viewerId`, then an editor when edit was asked for,
then the best-priority viewer for the kind or an ancestor, then a fallback
viewer, then any component that declared `opens` for the kind.

A component can declare that it opens a kind, which is how the shipped viewers
work without an application registering anything:

```ts
{
  component: 'MarkdownViewer',
  opens: { resourceKinds: ['file.markdown'], title: 'Markdown', priority: 50 },
  renderer: { kind: 'function', render: MarkdownViewer },
}
```
