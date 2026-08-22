---
title: Keybindings
parent: Platform
nav_order: 2
---

<!-- docs:setup
declare const app: import('@textui/core').TextUIApp;
-->

# Keybindings

A keybinding names a command; it never carries the behaviour itself.

```ts
app.keybindings.register({ keys: 'ctrl+p', commandId: 'app.palette' });
app.keybindings.register({ keys: 'ctrl+k ctrl+s', commandId: 'file.save' });
app.keybindings.register({ keys: 'r', commandId: 'service.restart', scopeId: 'services-table' });
```

A chord is a sequence: `ctrl+k` alone stays pending until the next stroke or a
timeout, so it does not block `ctrl+k` bound on its own.

## Order of dispatch

The focused node sees a key **first**, then chords, then global handlers. This
order is not an implementation detail - without it, typing `q` in a search box
quits the application.
