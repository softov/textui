# @textui/testing

A headless harness for TextUI applications. No terminal, no timers, no
snapshots of a screen nobody looked at.

```bash
npm install --save-dev @textui/testing
```

```ts
import { renderApp } from '@textui/testing';

const t = await renderApp(<App />, { width: 80, height: 24 });

expect(t.getByRole('button', { name: 'Save' }).focused).toBe(true);
t.press('enter');
await t.settle();
expect(t.text()).toContain('Saved');
```

## Query by what it is, not where it is

Every component declares a semantic role, so a test asks the way a person would
- the Save button, the row labelled `api` - rather than by index into a tree
that changes the moment the layout does.

| | |
|---|---|
| `getByRole(role, { name })` | The one with that role and accessible name |
| `getByLabel` / `getByText` | By label, or by rendered text |
| `getByComponent(name)` | The escape hatch, when the role is not the point |
| `text()`, `line(y)`, `lines()` | What is actually on the screen |
| `tree()` | The instance tree, for when the pixels are not the question |

An `Element` is a description - role, label, text, rect, focus, props - not a
handle. You act on the application with keys, the way a person does.

`get*` throws with the near misses listed; `query*` returns null.

## Drive it, then let it settle

`press('ctrl+s')`, `pressAll('down', 'down', 'enter')`, `type('hello')`, and
`resize(w, h)`. Effects and re-renders are asynchronous, so `await t.settle()`
is what separates "I sent the key" from "the screen caught up".

## Test at two sizes

A single fixed size skips every breakpoint and hides the layout break you were
trying to catch. `resize` is cheap, and a loop over two sizes costs one line:

```ts
for (const size of [{ width: 100, height: 30 }, { width: 60, height: 18 }]) {
  it(`fits at ${size.width}x${size.height}`, async () => { /* ... */ });
}
```

## Runtime

Depends on [`@textui/core`](https://www.npmjs.com/package/@textui/core) and [`@textui/terminal`](https://www.npmjs.com/package/@textui/terminal). No `node:` imports - it runs
on the virtual terminal, so there is no tty to have. Node 22+ and Bun.

## Documentation

<https://softov.github.io/textui/>

<!-- family -->

---

Part of **[TextUI](https://github.com/softov/textui)** - [documentation](https://softov.github.io/textui/) - [getting started](https://softov.github.io/textui/getting-started.html)

[`@textui/kit`](https://www.npmjs.com/package/@textui/kit) one install · [`@textui/core`](https://www.npmjs.com/package/@textui/core) the runtime · [`@textui/widgets`](https://www.npmjs.com/package/@textui/widgets) the catalog · [`@textui/terminal`](https://www.npmjs.com/package/@textui/terminal) adapters and input · **`@textui/testing`** the harness · [`@textui/cli`](https://www.npmjs.com/package/@textui/cli) the CLI
