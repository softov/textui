# surfaces

Chrome built out of surfaces, with no shell registered.

```bash
pnpm example surfaces
pnpm example surfaces --static --width 92
pnpm example surfaces --theme workbench
```

```text
 surfaces  no shell registered                            1 region  2 tabs  3 stack  q quit
 Pages              ┌ north ──────────────────────────────────────────────────────────────┐
 ▸ Overview         │ full width, above the row                                           │
   Detail           └─────────────────────────────────────────────────────────────────────┘
   History          ┌ west ──────────┐┌ centre ─────────────────────────┐┌ east ──────────┐
 ────────────────── │ shares the mi… ││ a mount is a node, a layout de… ││ shares the mi… │
 Inspector          └────────────────┘└─────────────────────────────────┘└────────────────┘
 surface  inspector ┌ south ──────────────────────────────────────────────────────────────┐
 mounted in nav     │ full width, below the row                                           │
 shell      plain   └─────────────────────────────────────────────────────────────────────┘
 canvas layout:  region                every region here is a surface this app named itself
```

## What it is here to show

Every other example, and every shipped shell, uses surfaces a shell already
made. That leaves four things unexercised, and all four are load-bearing:

| | the claim | where to look |
|---|---|---|
| **no shell** | a shell is a convenience, not a requirement | `main.tsx`, which passes `root` and registers no shells |
| **any name** | a surface name is the application's to invent | `toolbar`, `canvas`, `footer`, `inspector` - none are in `SurfaceName`'s list |
| **nesting** | a surface goes inside a surface | `inspector` is a mount on `nav` |
| **own layout** | a layout is a component, so write one | `RegionLayout`, a border layout in twenty lines |

## A surface is a name and a list

That is the whole of it. A surface has no geometry: it is a name, the mounts
opened against it, and `SurfaceState` - which layout, which mount is active,
visible, collapsed, what size it asked for. Where it *lands* is decided by
wherever a `SurfaceArea` for that name sits in the tree.

So the runtime never validates a surface name. Setting state on one is what
brings it into being, and a name nobody has mentioned yet returns default
state rather than an error:

```ts
app.surfaces.setState('canvas', { layout: 'region' });
app.surfaces.open({ surface: 'canvas', key: 'north:panel', target: { component: 'DemoRegion' } });
```

## No shell

`registerBuiltins` does three things: the component catalog, the layouts, and
the four shipped shells. This example does the first two by hand and skips the
third, which is the entire difference:

```ts
app.components.registerMany(CATALOG);
for (const layout of BUILTIN_LAYOUTS) app.layouts.register(layout);
// and no app.shells.register(...)
```

With nothing registered under the current shell id, `rootNode()` falls through
to painting `root` on a themed canvas. That fall-through is one branch in
`app.ts`, and it is the only thing standing between an application and its own
chrome. The `Inspector` panel prints `app.activeShell()` so you can see the app
still *asks* for `plain` - there is simply nothing answering to it.

What you give up by skipping the shell is what a shell was doing for you:
placing the surfaces, and supplying a canvas background. Both are a `box` here.

## Nesting

A mount's target is a node, and `SurfaceArea` is a component. Nothing else is
needed:

```ts
app.surfaces.open({
  surface: 'nav', key: 'inspector',
  target: { component: 'SurfaceArea', surface: 'inspector' },
});
```

Whatever later fills `inspector` never learns where it ended up. That is the
point of addressing a surface by name.

## Writing a layout

A layout is a registered component receiving `{ surface, mounts, state }`. It
decides *where* each mount goes; `MountView` decides *what* a mount draws.
`RegionLayout` is a border layout - north and south full width, west/centre/east
sharing the row between them - and `1`, `2`, `3` move `canvas` between it and
the shipped `tabs` and `stack`. Nothing remounts: the same five mounts are
handed to a different component, because a layout is store state, not code.

### The rough edge

`RegionLayout` reads each mount's region from its **key prefix**
(`north:panel`), a convention this example invents rather than something the
library offers. `Mount` carries `key`, `display`, `policy`, `when`,
`dataContext` and `order`, and nothing free form - so a layout that needs a
fact about a mount has to smuggle it through one of those. A `meta` field on
`Mount` would be the honest fix, and until there is one, any custom layout that
positions mounts will be doing something like this.
