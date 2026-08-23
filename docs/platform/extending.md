---
title: Extension points
parent: Platform
nav_order: 6
---

<!-- docs:setup
import { useRequiredService } from '@textui/core';
import type {
  ComponentDefinition, DataProviderDefinition, ResourceKind,
  ResourceViewerDefinition, ThemeDefinition,
} from '@textui/core';
declare const app: import('@textui/core').TextUIApp;
declare const url: string;
declare const midnight: ThemeDefinition;
declare class ApiClient { constructor(base: string); }
declare const restartCommand: import('@textui/core').CommandDefinition;
declare const scaleCommand: import('@textui/core').CommandDefinition;
declare const serviceKind: ResourceKind;
declare const servicesProvider: DataProviderDefinition;
declare const serviceViewer: ResourceViewerDefinition;
declare const ServiceTableDefinition: ComponentDefinition;
-->

# Extension points

Separate typed registries rather than one generic plugin bag: every category has its own contract, so a bad contribution fails where it is written instead of at some later lookup.

## The registries

<!-- docs:nocheck -->
```ts
app.components.register({ component, renderer, category, role, opens });
app.commands.register({ id, title, when, args, slots, run });
app.keybindings.register({ keys, commandId, when, scopeId });
app.themes.register({ id, name, appearance, extends, colors, glyphs });
app.layouts.register({ name, component, surfaces });
app.shells.register({ id, title, component, surfaces, theme, minSize });
app.screens.register({ id, component, keepAlive });
app.resources.registerKind / registerProvider / registerViewer / registerEditor / registerAction;
app.store.registerDataProvider / registerSchema / registerPersistence;
app.services.provide(key, value);
```

Every one returns a `Disposable`. Registration is reversible, which is what makes a manifest unloadable.

## Manifests

One source contributing to several registries at once, unwound by a single disposable:

```ts
await app.manifest.load({
  source: { id: 'acme.services', version: '1.2.0', displayName: 'Services' },
  requires: ['acme.core'],
  requiresCapabilities: ['mouse'],
  contributes: {
    components: [ServiceTableDefinition],
    commands: [restartCommand, scaleCommand],
    keybindings: [{ keys: 'r', commandId: 'service.restart' }],
    themes: [midnight],
    resourceKinds: [serviceKind],
    resourceViewers: [serviceViewer],
    dataProviders: [servicesProvider],
    computed: [{ path: '$/summary/services/down', def: { from: ['$/services/list'], select: 'count' } }],
    views: [{ surface: 'sidebar', key: 'services', target: { component: 'ServiceList' } }],
  },
});

app.manifest.unload('acme.services');   // everything above, undone
```

Views mount last, because they may name a component the same manifest just added.

`app.manifest.sources()` lists what is loaded, and `loaded(id)` answers for one.
That is what lets an application show its own extensions without knowing any of
them by name.

## Loading one from disk

A manifest is a value, so something has to go and get it. In textide that is
`loadExtensions`, which reads the specifiers out of `.textide.json` and imports
each one. A module may export a `manifest`, an `activate`, or both:

<!-- docs:nocheck -->
```ts
// The declarative half. No code runs; the registries take the definitions.
export const manifest: Manifest = {
  source: { id: 'acme.services', displayName: 'Services', description: 'What is running.' },
  contributes: {
    components: [ServiceListDefinition],
    views: [{ surface: 'sidebar', key: 'services', target: { component: 'ServiceList' } }],
  },
};

// The other half, for what a declaration cannot express - a subscription, a
// process, anything that needs the app in hand. Returns its own undo.
export function activate(app: TextUIApp, context: ExtensionContext): Disposable {
  return app.store.subscribe('$/services/list', () => { /* … */ });
}
```

### Starting from one that works

`New Extension` in the palette writes a working one into `tools/`, loads it,
and opens the source. It contributes a sidebar panel that counts the lines,
words and characters in the open file - small enough to read in one sitting,
and the fastest way to learn a plugin system is to delete things from a plugin
that works.

What it writes has **no imports in it**, which is worth noticing rather than
being a simplification. Its panel is a `template` renderer - a tree of data
whose props are `{ path: '$/somewhere' }`, read out of the store by the runtime
and redrawn when they change:

<!-- docs:nocheck -->
```js
renderer: {
  kind: 'template',
  template: {
    component: 'box',
    direction: 'column',
    children: [
      { component: 'text', content: { path: '$/word-count/name' }, bold: true },
      { component: 'text', content: { path: '$/word-count/lines' }, fg: 'muted' },
    ],
  },
},
```

JSX compiles to exactly this data, so an extension needs nothing installed
beside it and no build step to be loadable. It also rules out hooks, which are
imports - which is why in the scaffold the counting lives in `activate` and the
panel is bindings.

`Add Extension` takes a package name; `Add Extension from File` opens a picker.
Either way the specifier is written into `.textide.json`, relative to the
workspace, so it comes back next time and travels with the project.

The manifest loads first, because `activate` may want what it brought. Each
extension gets its own bag, so one can be disposed without touching the others,
and the loader keeps what only a loader knows: which specifier produced which
source, which one failed and why, and which one has been turned off.
`app.manifest.sources()` lists what loaded - it cannot list what did not.

## Services

A typed lookup table, not a dependency-injection container. No lifecycles, no scoping rules, no auto-wiring - a child falls back to its parent and that is all.

```ts
import { serviceKey } from '@textui/core';

const ApiKey = serviceKey<ApiClient>('acme.api');

app.services.provide(ApiKey, new ApiClient(url));
// in a component
const api = useRequiredService(ApiKey);   // throws with the key id when missing
```

## Registries for the CLI

An organisation can publish its own component registry - a directory with a `registry.json` and the source files it names - and point projects at it:

```bash
textui registry add internal ../design-system/registry
textui add --registry internal ops-header
```

A registry manifest carries what the CLI needs to be useful later: version, files, dependencies, required and optional capabilities, variants, store bindings, related components and template membership.

## Custom host primitives

`canvas` is the escape hatch, and it is enough for most things that do not fit the box model:

```tsx
<canvas
  intrinsic={{ height: 6 }}
  draw={(surface, ctx) => {
    for (let x = 0; x < surface.rect.width; x++) {
      surface.put(x, 0, ctx.glyph('bulletFilled'), { fg: ctx.color('accent') });
    }
  }}
/>
```

The surface is clipped to the node's content box and drawn in its own coordinate space, so a chart never needs to know where on screen it landed.

## The inspector

```ts
app.inspect();   // the component tree: rects, props, roles, bindings, render reasons
app.stats();     // renders, runs in the last frame, mounted instances
```

`inspect()` is what the test harness queries and what a development inspector would render. With `diagnostics: true` each instance also carries *why* it last rendered - `mount`, `props`, `store $/path` - which is usually the fastest way to find a component re-rendering for no reason.
