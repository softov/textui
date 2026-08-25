---
title: Writing a component
parent: Components
nav_order: 9
---

<!-- docs:setup
declare const app: import('@textui/core').TextUIApp; -->

# Writing a component

A component is a function that returns nodes. Give it a name so the registry and the inspector can talk about it:

```tsx
import { defineComponent, useTheme, type BoxProps } from '@textui/core';

export interface ServerStatusProps extends BoxProps {
  status: 'up' | 'down';
}

export const ServerStatus = defineComponent<ServerStatusProps>('ServerStatus', ({ status, ...rest }) => {
  const theme = useTheme();
  return (
    <box role="status" direction="row" gap={1} {...rest}>
      <text content={status === 'up' ? theme.glyphs.bulletFilled : theme.glyphs.bulletHollow}
            fg={status === 'up' ? 'success' : 'danger'} />
      <text content={status} />
    </box>
  );
});
```

Then register it, so a graph can name it:

<!-- docs:local
import type { RenderOutput } from '@textui/core'; declare function ServerStatus(): RenderOutput; -->

```ts
app.components.register({
  component: 'ServerStatus',
  category: 'display',
  role: 'status',
  renderer: { kind: 'function', render: ServerStatus },
});
```

Three rules, learned the hard way:

- **Ask the theme for glyphs.** Hardcoding `'●'` is how an ascii terminal ends up with a question mark.
- **Set `role` on the node you render**, not only in the registration - the inspector and the test harness read the node.
- **Namespace anything an application owns** (`Advisor.ServerStatus`). The registry is flat and shared.

A component can also be registered as `{ kind: 'lazy', load }` - the catalog then costs a name until something mounts it - or as `{ kind: 'template' }`, a component defined as data all the way down.
