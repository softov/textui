---
title: Testing
nav_order: 12
has_children: true
---

# Testing

```bash
pnpm add -D @textui/testing
```

The harness drives a real application against a virtual terminal, so what a test
asserts is what a terminal would receive.

```ts
import { render, renderApp } from '@textui/testing';

const t = await render(<Services />, { width: 80, height: 24 });

expect(t.getByRole('table')).toBeDefined();
t.press('down');
expect(t.hasText('billing-worker')).toBe(true);

await t.unmount();
```
