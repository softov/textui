---
title: Navigation
parent: Platform
nav_order: 5
---

<!-- docs:setup
import type { RenderOutput } from '@textui/core'; declare const app: import('@textui/core').TextUIApp; declare function Services(): RenderOutput; -->

# Navigation

Screens and a stack, not a router.

```ts
app.screens.register({ id: 'services', component: <Services /> });
app.screens.register({ id: 'detail', component: 'TaskDetail' });   // or a registered name
app.screens.reset('services');

app.screens.push('detail', { taskId: 'billing' });
app.screens.pop();          // focus is restored to where it was
```

The screen on top of the stack is **a mount in a surface**, exactly like `root` is. That is what makes it a screen and not a second rendering path: the shell arranges it, the layouts apply to it, and anything reading the surface registry sees it. Only the top is mounted - what a screen underneath keeps is its store scope, not its instances.

`surface` says where it goes, and defaults to `main`. A surface is the application's word, so a screen that wants to be a side panel says `surface: 'inspector'` and nothing in the library has to know what that means.

**Parameters arrive twice, on purpose.** They are spread onto the screen's node as props, which is the readable way for a screen to take an id; and they are published at `$/layout/screen/params`, which is the only way to read them eight levels down without every box in between forwarding something it does not care about.

<!-- docs:nocheck -->
```tsx
const TaskDetail = defineComponent<{ taskId?: string }>('TaskDetail', ({ taskId }) => …);

// or, from anywhere inside the screen
const { id, params } = useScreen<{ taskId: string }>();
const nav = useNavigate();
```

**Each screen is its own focus scope**, named `screen:<id>`. Tab order belongs to what is on screen rather than to the application, and it is why `pop` can put focus back: "where it was" is a question about a scope that died with its screen, not about an id that outlived it.

A screen's own store scope (`$/screen.<id>/…`) is cleared when it is popped, unless it declared `keepAlive`. The current entry is published at `$/layout/screen/current` and the stack at `$/layout/screen/stack`, so a breadcrumb or a back button is a `when` clause rather than a subscription.
