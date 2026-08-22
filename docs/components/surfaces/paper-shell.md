---
title: PaperShell
parent: Surfaces, shells and resources
grand_parent: Components
---

# PaperShell
{: .no_toc }

An airy, mostly borderless frame for something read rather than watched.

```tsx
import { createApp, registerBuiltins } from '@textui/core';
import { createNodeTerminal } from '@textui/terminal';

const app = createApp({
  terminal: createNodeTerminal(),
  shell: 'paper',
  onBoot: registerBuiltins,
});
```

## Props

<!-- props:start -->
_No props of its own._
<!-- props:end -->

Generous spacing, few rules. For a report, a document or a wizard - anything
read once rather than monitored.

This is the shell that exercises the "no border" path in every component, which
is why [`Panel`](../layout/panel.md) has to render its title as a heading row
rather than into a rule.

## See also

- [ConsoleShell](console-shell.md) - the opposite trade
- [Panel](../layout/panel.md) - what changes when borders go away
