# Commands, focus and layers

## Commands

A command is the only way an action should be spelled. A button that calls an API directly and a palette entry that calls the same API are two implementations that will drift; a button that runs a registered command cannot.

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

### The palette

```tsx
app.layers.open({
  id: 'palette',
  layer: 'modal',
  trapFocus: true,
  node: { component: 'CommandPalette', width: 60 },
});
```

That is the whole wiring. The palette searches the registry itself and **runs what it finds**, so choosing "Open a dialog" there and pressing the button that opens a dialog are the same act reaching the same code. Pass `execute={false}` to make it a picker that only reports the choice.

It shows what it knows about each command - category, keybinding, and the description of the highlighted row - and rules between categories, so a registry of forty commands reads as a few groups rather than a wall.

**Sub-items come from the command, not from the palette.** A command that declares an argument with `choices` is asked about rather than run:

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

Choosing it opens a second level listing the tones - filterable, with escape going back a level rather than closing - and picking one runs the command with that argument. `choices` may be a function, and may be async, so a list can come from a registry:

```ts
choices: () => app.themes.list().map((t) => t.id),
```

Nothing in the command knows the palette exists. It states what it needs; the palette is one of the things that can ask.

### Scopes

A command may be registered at `app`, `screen`, `region` or `component` scope, and resolution walks from the most specific outward. That is how `table.search` can mean whichever table is focused without every table inventing its own id.

```tsx
useCommand({
  id: 'table.search',
  title: 'Search this table',
  scope: 'component',
  run: () => setSearching(true),
});
```

## Keybindings

```ts
app.keybindings.register({ keys: 'ctrl+p', commandId: 'app.palette' });
app.keybindings.register({ keys: 'ctrl+k ctrl+s', commandId: 'file.save' });
app.keybindings.register({ keys: 'r', commandId: 'service.restart', scopeId: 'services-table' });
```

A chord is a sequence: `ctrl+k` alone stays pending until the next stroke or a timeout, so it does not block `ctrl+k` bound on its own.

### Order of dispatch

The focused node sees a key **first**, then chords, then global handlers. This order is not an implementation detail - without it, typing `q` in a search box quits the application.

## Focus

```tsx
const focus = useFocus({ autoFocus: true });

useInput((event) => {
  if (event.name === 'enter') { activate(); return true; }
  return false;
}, { focusId: focus.id });

return <box id={focus.id} role="button" bold={focus.focused}>…</box>;
```

Or without a hook, on any node:

```tsx
<box focusable id="cell-a1" onKey={(e) => { … }} />
```

### Order and direction

Tab order is registration order within a scope, unless a node states `order`. Directional navigation is geometric, because "the thing to the right" is a real question a table, a menu and a dashboard all ask, and none can answer it from document order. Distance along the requested axis is weighted more heavily than drift across it, so `right` from a table cell finds the next column rather than a distant button.

### Scopes and traps

```tsx
useFocusScope({ trap: true, restore: true, autoFocus: true });
```

A modal traps: tab cannot leave while it is active. `restore` puts focus back where it was when the scope deactivates, which is what makes closing a dialog feel like nothing happened.

**Scopes are inherited.** A control inside a dialog registers in the dialog's scope without being told about it - `useFocus` reads the nearest enclosing scope, and so does a `focusable` prop. This matters more than it sounds: a trap filters the tab order down to its own scope, so a control filed in the global one is not merely out of order, it is unreachable, and the dialog looks broken in a way that nothing reports. Pass `scopeId` explicitly only to override.

**`autoFocus` claims focus; it does not steal it.** A control marked `autoFocus` takes focus only if nothing in its scope has it yet. A prompt dialog is the case that forces the rule: it has an auto-focused text field *and* a default button, and whichever mounted last would otherwise win - which is how the dialog that exists to ask for text ends up with the text field unfocused.

## Layers

Five planes: `base`, `floating`, `modal`, `notification`, `debug`. Dialogs, dropdowns, context menus, tooltips, palettes and toasts are entries on one, so focus trapping, dismissal, positioning and paint order are decided once.

```ts
app.layers.open({
  id: 'confirm',
  layer: 'modal',
  scrim: true,
  trapFocus: true,
  dismissOnEscape: true,
  position: { kind: 'center' },
  node: { component: 'Dialog', title: 'Restart?', children: … },
  onClose: (reason) => { /* 'escape' | 'outside' | 'timeout' | 'api' */ },
});
```

Positioning is `center`, `screen`, `point`, `cursor`, or `anchor` - anchored to a focusable by id, on a side, with an alignment. Layers are composed at the root rather than inside the tree, so an overlay is never clipped by whatever opened it.

`scrim: true` **washes** what is behind rather than covering it: a terminal has no alpha, so the choice is between hiding the screen under a rectangle and moving its colours toward the scrim. Moving them keeps the application recognisable behind the dialog, which is the point of dimming. A cell left at the terminal's default colour cannot be blended - there is no way to know what colour it is - so it gets the dim attribute instead.

A component that opens a layer should not also consume the key that closes it. `Dialog` consumes escape only when it was given an `onClose`; otherwise it lets the layer manager dismiss it.

## Navigation

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

```tsx
const TaskDetail = defineComponent<{ taskId?: string }>('TaskDetail', ({ taskId }) => …);

// or, from anywhere inside the screen
const { id, params } = useScreen<{ taskId: string }>();
const nav = useNavigate();
```

**Each screen is its own focus scope**, named `screen:<id>`. Tab order belongs to what is on screen rather than to the application, and it is why `pop` can put focus back: "where it was" is a question about a scope that died with its screen, not about an id that outlived it.

A screen's own store scope (`$/screen.<id>/…`) is cleared when it is popped, unless it declared `keepAlive`. The current entry is published at `$/layout/screen/current` and the stack at `$/layout/screen/stack`, so a breadcrumb or a back button is a `when` clause rather than a subscription.
