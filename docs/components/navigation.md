---
title: Navigation and overlays
parent: Components
nav_order: 7
has_children: true
---

<!-- docs:setup
import { confirm } from '@textui/widgets';
declare const app: import('@textui/core').TextUIApp;
-->

# Navigation and overlays

The chrome around a screen, and the things that appear on top of it.

## Navigation and chrome

`Tabs` `Breadcrumb` `Menu` `StatusBar` `Toolbar` `KeyHints` `Wizard`

`StatusBar` takes `leading` and `trailing` rather than `left` and `right`,
because those are style props on every node.

## Overlays

`Dialog` `PromptDialog` `Tooltip` `Toast` `ToastHost` `CommandPalette`, plus the
`confirm` and `prompt` helpers.

Every one is an entry on a layer rather than a component that draws over its
neighbours, so focus trapping, dismissal and paint order are decided once. A
dialog can be composed by hand out of public components, and the common case is
one line:

```ts
if (await confirm(app.layers, { message: 'Restart billing-worker?', tone: 'danger' })) {
  await app.execute('service.restart', { id: 'billing' });
}
```

`CommandPalette` searches the command registry rather than a list someone
maintains, so a command registered anywhere is reachable the moment it exists.
