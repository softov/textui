---
title: Focus
parent: Platform
nav_order: 3
---

<!-- docs:setup
import { useFocus, useFocusScope, useInput } from '@textui/core'; declare const activate: () => void; -->

# Focus

A terminal has no hover and no pointer to fall back on, so what has focus is the whole of what the reader can act on.

```tsx
export function Restart() {
  const focus = useFocus({ autoFocus: true });

  useInput((event) => {
    if (event.name === 'enter') { activate(); return true; }
    return false;
  }, { focusId: focus.id });

  return <box id={focus.id} role="button" bold={focus.focused}>Restart</box>;
}
```

Or without a hook, on any node:

<!-- docs:nocheck -->
```tsx
<box focusable id="cell-a1" onKey={(e) => { … }} />
```

## Order and direction

Tab order is registration order within a scope, unless a node states `order`. Directional navigation is geometric, because "the thing to the right" is a real question a table, a menu and a dashboard all ask, and none can answer it from document order. Distance along the requested axis is weighted more heavily than drift across it, so `right` from a table cell finds the next column rather than a distant button.

## Scopes and traps

```tsx
useFocusScope({ trap: true, restore: true, autoFocus: true });
```

A modal traps: tab cannot leave while it is active. `restore` puts focus back where it was when the scope deactivates, which is what makes closing a dialog feel like nothing happened.

**Scopes are inherited.** A control inside a dialog registers in the dialog's scope without being told about it - `useFocus` reads the nearest enclosing scope, and so does a `focusable` prop. This matters more than it sounds: a trap filters the tab order down to its own scope, so a control filed in the global one is not merely out of order, it is unreachable, and the dialog looks broken in a way that nothing reports. Pass `scopeId` explicitly only to override.

**`autoFocus` claims focus; it does not steal it.** A control marked `autoFocus` takes focus only if nothing in its scope has it yet. A prompt dialog is the case that forces the rule: it has an auto-focused text field *and* a default button, and whichever mounted last would otherwise win - which is how the dialog that exists to ask for text ends up with the text field unfocused.
