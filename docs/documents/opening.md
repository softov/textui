---
title: Opening one
parent: Documents
nav_order: 5
---

<!-- docs:setup
declare const app: import('@textui/core').TextUIApp; declare const uri: string; -->

# Opening one

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
