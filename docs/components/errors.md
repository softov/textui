---
title: When one throws
parent: Components
nav_order: 10
---

<!-- docs:setup
import type { RenderError, RenderOutput } from '@textui/core';
declare const app: import('@textui/core').TextUIApp;
declare function ServerStatus(): RenderOutput;
-->

# When one throws

There is no boundary component to wrap things in, because a throw does not
unmount anything. The reconciler catches it around the component that threw,
renders something in its place, and leaves the rest of the tree standing:

```
above
Boom: kaboom
below
```

The failure also reaches `app.errors()` with its stack, and the application
stays interactive - resizing, input and every sibling keep working. This is
the difference from React, where an uncaught throw takes the tree down and a
boundary is what stops it. Here containment is the default and a fallback only
changes *what is shown*.

Declare one on the component, so it applies wherever the component is used:

```ts
app.components.register({
  component: 'ServerStatus',
  renderer: { kind: 'function', render: ServerStatus },
  fallback: { component: 'text', content: 'status unavailable', fg: 'muted' },
});
```

A node fallback is handed the failure as the `errorMessage` and `error` props,
so a registered component can render it. Props the fallback declares itself
win, which is how you show something deliberately vague instead:

<!-- docs:nocheck -->
```ts
fallback: { component: 'ErrorPanel' }                       // gets errorMessage
fallback: { component: 'text', content: 'unavailable' }     // says nothing
```

For the local case, a fallback may instead be a function receiving the failure
- the thrown value, its message, and which component threw:

```tsx
const node = {
  component: 'ServerStatus',
  $meta: {
    fn: ServerStatus,
    fallback: (failure: RenderError) => ({
      component: 'text',
      content: `${failure.component} failed: ${failure.message}`,
      fg: 'danger',
    }),
  },
};
```

The same fallback answers a component name that was never registered - a miss
and a throw are the same question, *what does this render instead*. Without
one, a miss renders `<ServerStatus>` and a throw renders its message, both in
`danger`, because a failure nobody can see is one nobody fixes.
