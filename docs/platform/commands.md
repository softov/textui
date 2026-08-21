---
title: Commands
parent: Platform
nav_order: 1
---

# Commands

A command is the only way an action should be spelled. A button that calls an
API directly and a palette entry that calls the same API are two implementations
that will drift; a button that runs a registered command cannot.

```ts
app.commands.register({
  id: 'service.restart',
  title: 'Restart service',
  category: 'Services',
  slots: ['palette', 'context'],
  when: "$/session/role == 'operator'",
  args: [{ name: 'id', type: 'string', required: true }],
  run: async (args, ctx) => {
    await restart(String(args.id));
    ctx.store.set('$/services/lastRestart', args.id);
  },
});
```

- **`when`** is a small expression over store paths. Chrome that should not exist for this user does not mount, rather than mounting disabled.
- **`slots`** is where the command offers itself: `palette`, `hints`, `context`, or anything an application invents.
- **`args`** are validated before `run`, so a typo in a keybinding fails loudly rather than passing `undefined` into an API call. An arg that declares `choices` also becomes a sub-menu in the palette - see below.

## The palette

```tsx
app.layers.open({
  id: 'palette',
  layer: 'modal',
  trapFocus: true,
  node: { component: 'CommandPalette', width: 60 },
});
```

That is the whole wiring. The palette searches the registry itself and **runs
what it finds**, so choosing "Open a dialog" there and pressing the button that
opens a dialog are the same act reaching the same code. Pass `execute={false}`
to make it a picker that only reports the choice.

It shows what it knows about each command - category, keybinding, and the
description of the highlighted row - and rules between categories, so a registry
of forty commands reads as a few groups rather than a wall.

**Sub-items come from the command, not from the palette.** A command that
declares an argument with `choices` is asked about rather than run:

```ts
app.commands.register({
  id: 'app.toast',
  title: 'Show a toast',
  slots: ['palette'],
  args: [{
    name: 'tone',
    type: 'string',
    required: true,
    description: 'How loud the toast should be.',
    choices: ['info', 'success', 'warning', 'danger'],
  }],
  run: (args) => notify(app, { tone: String(args.tone), message: '…' }),
});
```

Choosing it opens a second level listing the tones - filterable, with escape
going back a level rather than closing - and picking one runs the command with
that argument. `choices` may be a function, and may be async, so a list can come
from a registry:

```ts
choices: () => app.themes.list().map((t) => t.id),
```

Nothing in the command knows the palette exists. It states what it needs; the
palette is one of the things that can ask.

## Scopes

A command may be registered at `app`, `screen`, `region` or `component` scope,
and resolution walks from the most specific outward. That is how `table.search`
can mean whichever table is focused without every table inventing its own id.

```tsx
useCommand({
  id: 'table.search',
  title: 'Search this table',
  scope: 'component',
  run: () => setSearching(true),
});
```
