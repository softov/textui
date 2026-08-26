---
title: Keybindings
parent: Platform
nav_order: 2
---

<!-- docs:setup
declare const app: import('@textui/core').TextUIApp; -->

# Keybindings

A keybinding names a command; it never carries the behaviour itself.

```ts
app.keybindings.register({ keys: 'ctrl+p', commandId: 'app.palette' });
app.keybindings.register({ keys: 'ctrl+k ctrl+s', commandId: 'file.save' });
app.keybindings.register({ keys: 'r', commandId: 'service.restart', scopeId: 'services-table' });
```

A chord is a sequence: `ctrl+k` alone stays pending until the next stroke or a timeout, so it does not block `ctrl+k` bound on its own.

## Order of dispatch

The focused node sees a key **first**, then chords, then global handlers. This order is not an implementation detail - without it, typing `q` in a search box quits the application.

Escape has one step ahead of the chords: a layer that traps focus and has `dismissOnEscape` closes before any binding is offered the key. A modal has claimed the keyboard, so nothing behind it should be acting on keys - without this, an application with a global `escape` binding, which most have, could never dismiss a dialog with escape. What that looks like is a confirm you cannot leave, over a screen that navigated somewhere else while you were reading it.

A layer that does *not* trap focus - a toast, a tooltip - keeps the ordinary order, so escape still reaches the application while one happens to be up. See [Layers](layers.md).

## Shift, and what a terminal can tell you

Shift is part of a stroke only when it is **not the only modifier**.

```ts
app.keybindings.register({ keys: 'ctrl+shift+f', commandId: 'find.inWorkspace' });
```

A terminal reports a bare shift through the character it produced: press shift and `p` and what arrives is `P`, with no shift bit beside it. So `shift+p` is filed as `p` - naming shift there would wait for a stroke nothing sends.

Held with `ctrl`, `alt` or `meta` it is the other way round. A control code carries no case, so `ctrl+shift+f` cannot arrive as an uppercase letter: a terminal speaking a keyboard protocol sends the *unshifted* key and a shift bit beside it. There shift is the only thing separating the two chords, and it stays in the stroke.

The same physical key can therefore be two different strokes. `?` is already shift and `/`, so a plain terminal sends `alt+?` and a protocol-speaking one sends `alt+shift+/`. Bind both if you want the key to work everywhere.

`ctrl+shift+<letter>` needs a terminal that negotiated a keyboard protocol at all - a plain one sends one control byte for both, and the unshifted binding wins. It costs nothing where it does not arrive, but it should never be the *only* way to reach something.

## A key that carries arguments

A binding may pass arguments, which makes it a key for one invocation rather than for the command:

```ts
app.keybindings.register({
  keys: 'ctrl+b',
  commandId: 'view.toggle',
  args: { surface: 'sidebar' },
  title: 'Show or Hide the Sidebar',
});
```

`title` is what *this key* does, for the shortcut sheet and anything else listing keys - the command is called "Toggle Surface", which is true of the command and not of the key.

For the same reason `forCommand` leaves argument-bearing bindings out. A menu row for "Toggle Surface" that offered `ctrl+b` as its shortcut would name a key that does something narrower. Match on `args` through `list()` when the specific invocation is what you want.
