# Testing

```bash
pnpm add -D @textui/testing
```

The harness drives a real application against a virtual terminal, so what a test asserts is what a terminal would receive.

```ts
import { render, renderApp } from '@textui/testing';

const t = await render(<Services />, { width: 80, height: 24 });

expect(t.getByRole('table')).toBeDefined();
t.press('down');
expect(t.hasText('billing-worker')).toBe(true);

await t.unmount();
```

## Query by meaning, not by ANSI

Queries are semantic first, because a test pinned to exact escape sequences fails on every legitimate change and passes on none of the interesting bugs.

```ts
t.getByRole('button', { name: 'Restart' });
t.getAllByRole('listitem');
t.getByLabel('Password');
t.getByText('billing-worker');
t.getByComponent('Table');
t.queryByRole('dialog');          // null rather than throwing
```

A missing match prints the frame. An ambiguous one lists what matched and asks you to narrow it, rather than silently picking the first.

## Input

```ts
t.press('ctrl+k');
t.pressAll('tab', 'tab', 'enter');
t.type('softov');                 // one key at a time, with a render between
t.paste('a whole clipboard');
t.click(10, 4);
t.clickOn(t.getByRole('button'));
t.wheel(10, 4, -3);
t.feed('\x1b[A');                 // raw bytes, through the real decoder
```

`type` renders between keystrokes, which is what a terminal does. Without that, a handler closing over stale props drops characters - a bug worth having a test for rather than a harness that hides it.

## Environment

```ts
t.resize(40, 12);
t.setCapabilities({ unicode: 'ascii', colorDepth: 0 });
t.setTheme('paper');
t.setShell('workbench');
t.advance(500);                   // the animation clock, by hand
await t.settle();                 // let promises land, then render
```

The capability call is the most valuable one in the file. Every component is supposed to degrade; this is how you find out whether it does.

## Structure and snapshots

```ts
t.tree();                         // the semantic tree
t.lines();                        // the frame, row by row
t.errors();                       // anything the runtime caught
t.stats();                        // renders, runs, mounted instances

expect(snapshot(t)).toMatchSnapshot();
expect(snapshot(t, { ruler: true })).toMatchSnapshot();   // with a column ruler
```

`stats().runs` is how many terminal writes the last frame cost. If a one-cell change reports a hundred runs, the diff has stopped working - which is a test worth writing for anything performance-sensitive.

## What the playgrounds assert

`playground/test/playgrounds.test.tsx` is the pattern worth copying. For every playground it mounts it, asserts it rendered something, asserts no unregistered component leaked through, resizes to 40 columns, strips Unicode and colour away, and renders it statically with no application at all.

A showcase nobody checks is a showcase that rots: someone changes a default, the gallery renders an empty box, and nobody notices for a month.
