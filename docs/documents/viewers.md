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

## What a kind looks like

An icon and a tone can be declared on a kind, or on a renderer that opens it:

<!-- docs:nocheck -->
```ts
{ id: 'file.markdown', title: 'Markdown', extends: 'file.text', icon: '¶', tone: 'info' }
```

`app.resources.appearanceOf({ kind })` answers with whichever spoke: the
highest-priority **renderer** for the kind first, because the thing that knows
what a markdown file is is the thing that opens markdown files - so a viewer an
extension brought names and colours its own rows, and the explorer never learns
what it opened. Then the kind itself, walking up `extends`, since
`file.markdown` inheriting Text's glyph beats inheriting nothing.

A **tone**, not a colour: a kind says `info` and the theme decides what that
looks like. A kind carrying `#d19a66` is a kind that looks wrong in half the
themes.

It answers `{}` when nobody has said, rather than a default - what an
undescribed thing looks like is the caller's vocabulary, because which glyphs a
terminal can draw is known where the terminal is. `ResourceExplorer` takes
`fileIcon` for exactly that row, the way it already takes `folderIcons`.

A decoration outranks both. "This file has changed" is news; "this is a
markdown file" is not, and the two would otherwise compete for one cell.
