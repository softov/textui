---
title: Driving input
parent: Testing
nav_order: 2
---

# Driving input

```ts
t.press('ctrl+k');
t.pressAll('tab', 'tab', 'enter');
t.type('softov');                 // one key at a time, with a render between
t.paste('a whole clipboard');
t.click(10, 4);
t.clickOn(t.getByRole('button'));
t.wheel(10, 4, -3);
t.feed('\x1b[A');                 // raw bytes, through the real decoder
```

`type` renders between keystrokes, which is what a terminal does. Without that, a
handler closing over stale props drops characters - a bug worth having a test for
rather than a harness that hides it.
