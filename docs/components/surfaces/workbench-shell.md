---
title: WorkbenchShell
parent: Surfaces, shells and resources
grand_parent: Components
---

# WorkbenchShell
{: .no_toc }

Rail, sidebar, main, panel, aside and status - the IDE arrangement.

```tsx
import { createApp } from '@textui/core';
import { registerBuiltins } from '@textui/widgets';
import { createNodeTerminal } from '@textui/terminal';

const app = createApp({
  terminal: createNodeTerminal(),
  shell: 'workbench',
  onBoot: registerBuiltins,
});
```

## Props

<!-- props:start -->
_No props of its own._
<!-- props:end -->

The largest of the four, and the one worth starting from for an application
with more than one thing on screen at once.

Every region is a surface, so which of them are visible is store state: a
sidebar can be collapsed, a panel toggled, an aside opened, all by writing a
path rather than by re-rendering a tree.

## See also

- [SurfaceArea](surface-area.md) - placing surfaces without a shell
- [RailLayout](rail-layout.md) - what the rail surface usually uses
- [Surfaces, shells and resources](../surfaces.md)
