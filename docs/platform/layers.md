---
title: Layers
parent: Platform
nav_order: 4
---

# Layers

Five planes: `base`, `floating`, `modal`, `notification`, `debug`. Dialogs,
dropdowns, context menus, tooltips, palettes and toasts are entries on one, so
focus trapping, dismissal, positioning and paint order are decided once.

<!-- docs:nocheck -->
```ts
app.layers.open({
  id: 'confirm',
  layer: 'modal',
  scrim: true,
  trapFocus: true,
  dismissOnEscape: true,
  position: { kind: 'center' },
  node: { component: 'Dialog', title: 'Restart?', children: … },
  onClose: (reason) => { /* 'escape' | 'outside' | 'timeout' | 'api' */ },
});
```

Positioning is `center`, `screen`, `point`, `cursor`, or `anchor` - anchored to a
focusable by id, on a side, with an alignment. Layers are composed at the root
rather than inside the tree, so an overlay is never clipped by whatever opened
it.

`scrim: true` **washes** what is behind rather than covering it: a terminal has
no alpha, so the choice is between hiding the screen under a rectangle and moving
its colours toward the scrim. Moving them keeps the application recognisable
behind the dialog, which is the point of dimming. A cell left at the terminal's
default colour cannot be blended - there is no way to know what colour it is - so
it gets the dim attribute instead.

A component that opens a layer should not also consume the key that closes it.
`Dialog` consumes escape only when it was given an `onClose`; otherwise it lets
the layer manager dismiss it.

## Asking a question

Three helpers open a layer and return a promise, so the common cases do not
need the block above:

<!-- docs:nocheck -->
```ts
const ok    = await confirm(app.layers, { message: 'Discard changes?', tone: 'danger' });
const name  = await prompt(app.layers, { title: 'Rename', initialValue: 'a.ts' });
const file  = await pick(app, { start: workspace.rootUri, wants: 'file' });
```

`pick` walks the **resource registry**, never the filesystem, so it works on
whatever is mounted rather than on `file:` alone - the first thing anyone wants
to pick off a remote is a file. `wants: 'directory'` adds a "Use this folder"
row, because when the answer is the place you are standing there is no child to
press enter on. Typing filters the list; `left` at the start of the filter goes
up a level; enter on a folder goes into it.

## A focused field and the keys past its ends

A focused node sees a key before anything else, and a `TextInput` answers
`left` and `right` itself. So a handler beside the field - even a global one -
never sees those keys, and a feature built on one silently does nothing.

`onEdge` is how the field hands them back:

<!-- docs:nocheck -->
```ts
h(TextInput, {
  value: query,
  onChange: setQuery,
  // Only fires when the caret is already at that end of the value.
  onEdge: (edge) => { if (edge === 'start') goUp(); },
});
```

The command palette drills into a command's choices this way, and the path
picker goes up a folder. `TextArea` has the same prop, for the same reason.
