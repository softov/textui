---
title: Capabilities
parent: Terminal
nav_order: 1
---

# Capabilities

What a terminal can do is detected once at boot, published to
`$/modus/capabilities`, and consulted by the theme and the writer rather than by
components.

```ts
{
  colorDepth: 24,          // 0 | 4 | 8 | 24
  unicode: 'full',         // 'ascii' | 'bmp' | 'full'
  wideChars: true,
  mouse: true, wheel: true, focusEvents: true, paste: true,
  hyperlinks: true, clipboard: true,
  altScreen: true, cursor: true,
  synchronizedOutput: true, title: true, kittyKeyboard: false,
}
```

Detection is deliberately conservative: claiming a capability the terminal lacks
corrupts the frame, while missing one only costs polish. `NO_COLOR` and
`FORCE_COLOR` are honoured; `TERM=dumb` and a non-TTY both fall to the minimal
set. Inside tmux or screen, hyperlinks and synchronised output are turned off
because multiplexers rewrite or mangle them.

Anything detection cannot settle, an override can:

```ts
createNodeTerminal({ capabilities: { unicode: 'ascii', colorDepth: 0 } });
app.setCapabilityOverrides({ mouse: false });
```
