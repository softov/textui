---
title: Resource adapters
parent: Documents
nav_order: 3
---

<!-- docs:setup
declare const app: import('@textui/core').TextUIApp;
-->

# Resource adapters

Everything one resource type needs, registered as one value. The registries
underneath stay separate - an adapter is a convenience for the author and a unit
of undo for the application, not a new mechanism.

> Not a [terminal adapter](../terminal/adapters.md). The two share the word and
> nothing else.

```ts
import { jsonAdapter } from '@textui/documents';

const registration = app.registerAdapter(jsonAdapter());
// ...
registration.dispose();   // removes exactly what it added
```

`ResourceAdapter` carries `kinds`, `providers`, `components`, `highlighters`,
`viewers`, `editors`, `actions`, `commands` and `keybindings`, plus a
`register(app)` escape hatch for anything the fields cannot express. They are
registered in that order, so a viewer always has its kind to match against.

The JSON adapter shipped in `@textui/core/adapters` is the worked example:

<!-- docs:nocheck -->
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

Nothing is registered by default. An adapter is a decision - that `.json` means
this kind, these viewers and these transforms - and decisions belong to the
application.

Two viewers for one kind is the point of `viewersFor(kind)`: it is what makes
"open with" a real choice, and what a screen offers when it lets you pick.
