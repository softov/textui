---
title: PlainShell
parent: Surfaces, shells and resources
grand_parent: Components
---

# PlainShell
{: .no_toc }

Header, main, status. The smallest arrangement that is still a shell.

```tsx
import { createApp, registerBuiltins } from '@textui/core';
import { createNodeTerminal } from '@textui/terminal';

const app = createApp({
  terminal: createNodeTerminal(),
  shell: 'plain',
  onBoot: registerBuiltins,
});
```

## Props

<!-- props:start -->
_No props of its own._
<!-- props:end -->

A shell decides where the surfaces go and nothing else. Switching between the
four shipped ones changes the frame without touching a single mount, which is
the property the whole surface system exists to give you.

`plain` places `header`, `main` and `status`. Anything opened into a surface
it does not place simply does not appear - which is worth knowing when a mount
seems to vanish.

## See also

- [WorkbenchShell](workbench-shell.md) - rail, sidebar, panel and aside as well
- [Surfaces, shells and resources](../surfaces.md) - the nine surface names
