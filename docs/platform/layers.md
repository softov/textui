---
title: Layers
parent: Platform
nav_order: 4
---

# Layers

Five planes: `base`, `floating`, `modal`, `notification`, `debug`. Dialogs,
dropdowns, context menus, tooltips, palettes and toasts are entries on one, so
focus trapping, dismissal, positioning and paint order are decided once.

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
