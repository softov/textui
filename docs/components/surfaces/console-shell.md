---
title: ConsoleShell
parent: Surfaces, shells and resources
grand_parent: Components
---

# ConsoleShell
{: .no_toc }

A dense, bordered frame for a monitoring screen.

```tsx
import { createApp, registerBuiltins } from '@textui/core';
import { createNodeTerminal } from '@textui/terminal';

const app = createApp({
  terminal: createNodeTerminal(),
  shell: 'console',
  onBoot: registerBuiltins,
});
```

## Props

<!-- props:start -->
_No props of its own._
<!-- props:end -->

Tight spacing and borders everywhere - for a screen watched continuously,
where density beats airiness and a boundary between panes matters.

Same surfaces as [`PlainShell`](plain-shell.md) plus `panel`. The mounts do
not change; only the frame does.

## See also

- [PaperShell](paper-shell.md) - the opposite trade
- [Themes](../../themes/) - which also change density
