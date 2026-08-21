---
title: Environment
parent: Testing
nav_order: 3
---

# Environment

```ts
t.resize(40, 12);
t.setCapabilities({ unicode: 'ascii', colorDepth: 0 });
t.setTheme('paper');
t.setShell('workbench');
t.advance(500);                   // the animation clock, by hand
await t.settle();                 // let promises land, then render
```

The capability call is the most valuable one in the file. Every component is
supposed to degrade; this is how you find out whether it does.
