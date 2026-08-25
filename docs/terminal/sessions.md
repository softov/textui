---
title: Managed and embedded sessions
parent: Terminal
nav_order: 2
---

<!-- docs:setup
import { createApp } from '@textui/core'; import { createNodeTerminal } from '@textui/terminal'; declare const terminal: ReturnType<typeof createNodeTerminal>; declare const app: import('@textui/core').TextUIApp; -->

# Managed and embedded sessions

`acquire` records exactly what it turned on, and `release` undoes exactly that and nothing else. That is the whole difference between the two modes.

```ts
// Managed: TextUI owns the terminal.
await app.start();   // alt screen, raw mode, mouse, bracketed paste, cursor hidden

// Embedded: the host already owns it.
createApp({
  terminal,
  session: { managed: false, altScreen: false, hideCursor: false },
});
```

A terminal left in raw mode with the cursor hidden is a broken shell, so the Node adapter also releases on `exit`, `SIGINT`, `SIGTERM` and `SIGHUP` - not only on a tidy `stop()`.
