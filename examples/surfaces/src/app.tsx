import {
  BUILTIN_LAYOUTS, CATALOG, MountView, SurfaceArea, createBag, defineComponent,
} from '@textui/core';
import type { Disposable, LayoutProps, Mount, RenderOutput, TextUIApp } from '@textui/core';
import { Inspector, Nav, Region, Status, Toolbar } from './panels.js';

/**
 * Chrome built out of surfaces, with no shell.
 *
 * A shell is a convenience, not a requirement. What one does is place
 * `SurfaceArea`s in a frame and hand that frame to the runtime; an application
 * that would rather place them itself passes a `root` and registers no shell at
 * all, which is what this does. `registerBuiltins` is not called here for
 * exactly that reason - it registers the catalog, the layouts *and* the four
 * shipped shells in one go, and the third of those is the thing being left out.
 *
 * Three claims this example exists to make good on, none of them obvious from
 * the types:
 *
 *   1. a surface name is the application's to invent. `toolbar`, `canvas` and
 *      `inspector` are not in `SurfaceName`'s suggested list and need not be -
 *      the registry never checks a name against anything, it hands out default
 *      state the first time it sees one;
 *
 *   2. a layout is a registered component, so an application can add its own.
 *      `region` below is a border layout in twenty lines;
 *
 *   3. a surface nests. A mount target is a node and `SurfaceArea` is a
 *      component, so putting one inside another needs no support from anywhere.
 */

/** Where the canvas keeps its layout, so the footer can say what it is. */
export const LAYOUT_PATH = '$/demo/canvasLayout';

type RegionName = 'north' | 'west' | 'centre' | 'east' | 'south';

/**
 * A border layout: north and south full width, west/centre/east in a row.
 *
 * The region comes from the mount key's prefix. That is a convention this
 * example invents, not something the library offers: `Mount` carries `key`,
 * `display`, `policy`, `when`, `dataContext` and `order` and nothing free
 * form, so a layout needing a fact about a mount has to encode it in one of
 * those. A prefix is the cheapest of the available bad options - a `meta`
 * field on `Mount` would be the honest one.
 */
const RegionLayout = defineComponent<LayoutProps>('RegionLayout', (props) => {
  const { mounts, surface: _surface, state: _state, ...rest } = props;
  const inRegion = (name: RegionName) => mounts.filter((m) => m.key.startsWith(`${name}:`));

  // `MountView` renders one mount's target, and is what every shipped layout
  // delegates to. A layout decides *where*; MountView decides *what*.
  //
  // North and south take the height they need; the middle row takes the rest.
  // Giving all three `flex: 1` splits the surface into equal thirds, which is
  // a border layout in name only.
  const view = (mount: Mount) => <MountView key={mount.key} mount={mount} />;
  const middle = (['west', 'centre', 'east'] as const).flatMap(inRegion);

  return (
    <box {...rest} direction="column" flex={1}>
      {inRegion('north').map(view)}
      <box direction="row" flex={1}>
        {middle.map((mount) => <MountView key={mount.key} mount={mount} flex={1} />)}
      </box>
      {inRegion('south').map(view)}
    </box>
  );
});

/**
 * The frame a shell would otherwise have drawn.
 *
 * Passed as `root`. With no shell registered the runtime paints this on a
 * themed canvas, which is the one thing a shell was providing that a plain box
 * does not.
 */
export const Frame: (props: Record<string, never>) => RenderOutput =
  defineComponent<Record<string, never>>('SurfacesFrame', () => (
  <box direction="column" width="100%" height="100%" bg="canvas" padding={1} gap={1}>
    <SurfaceArea surface="toolbar" height={1} />
    <box direction="row" flex={1} gap={1}>
      <SurfaceArea surface="nav" width={26} />
      <SurfaceArea surface="canvas" flex={1} />
    </box>
    <SurfaceArea surface="footer" height={1} />
  </box>
));

export function registerSurfaces(app: TextUIApp): Disposable {
  const bag = createBag();

  // The catalog and the layouts, but not the shells: `registerBuiltins` with
  // its third line left out.
  bag.add(app.components.registerMany(CATALOG));
  for (const layout of BUILTIN_LAYOUTS) bag.add(app.layouts.register(layout));

  bag.add(app.components.registerMany([
    { component: 'DemoToolbar', category: 'chrome', renderer: { kind: 'function', render: Toolbar } },
    { component: 'DemoStatus', category: 'chrome', renderer: { kind: 'function', render: Status } },
    { component: 'DemoNav', category: 'chrome', renderer: { kind: 'function', render: Nav } },
    { component: 'DemoInspector', category: 'chrome', renderer: { kind: 'function', render: Inspector } },
    { component: 'DemoRegion', category: 'display', renderer: { kind: 'function', render: Region } },
    { component: 'RegionLayout', category: 'chrome', renderer: { kind: 'function', render: RegionLayout } },
    // `defineComponent` names a component; it does not register one. The root
    // node is looked up by name like every other, so the frame needs this line
    // as much as anything mounted into it does.
    { component: 'SurfacesFrame', category: 'chrome', renderer: { kind: 'function', render: Frame } },
  ]));
  bag.add(app.layouts.register({ name: 'region', component: 'RegionLayout' }));

  // --- the surfaces -----------------------------------------------------
  //
  // Five names the library has never heard of. Setting state on one is what
  // brings it into being; there is nothing else to declare.
  app.surfaces.setState('toolbar', { layout: 'bar' });
  app.surfaces.setState('nav', { layout: 'stack' });
  app.surfaces.setState('canvas', { layout: 'region' });
  app.surfaces.setState('footer', { layout: 'bar' });

  bag.add(app.surfaces.open({ surface: 'toolbar', key: 'title', target: { component: 'DemoToolbar' } }));
  bag.add(app.surfaces.open({ surface: 'footer', key: 'status', target: { component: 'DemoStatus' } }));
  bag.add(app.surfaces.open({
    surface: 'nav', key: 'pages', display: { title: 'Pages' },
    target: { component: 'DemoNav' },
  }));

  // A surface inside a surface. `inspector` is mounted into `nav` by name and
  // filled separately - whatever fills it never learns where it ended up.
  bag.add(app.surfaces.open({
    surface: 'nav', key: 'inspector', display: { title: 'Inspector' },
    target: { component: 'SurfaceArea', surface: 'inspector' },
  }));
  app.surfaces.setState('inspector', { layout: 'stack' });
  bag.add(app.surfaces.open({
    surface: 'inspector', key: 'facts', target: { component: 'DemoInspector' },
  }));

  // --- the canvas's regions ---------------------------------------------
  const region = (name: RegionName, note: string) => app.surfaces.open({
    surface: 'canvas',
    key: `${name}:panel`,
    display: { title: name },
    target: { component: 'DemoRegion', name, note },
  });

  bag.add(region('north', 'full width, above the row'));
  bag.add(region('west', 'shares the middle row'));
  bag.add(region('centre', 'a mount is a node, a layout decides where it lands'));
  bag.add(region('east', 'shares the middle row'));
  bag.add(region('south', 'full width, below the row'));

  // --- switching the layout at runtime ----------------------------------
  //
  // A layout is store state, not code. Nothing remounts and nothing is
  // rebuilt: the same five mounts go to a different component.
  app.store.set(LAYOUT_PATH, 'region');

  for (const [key, layout] of [['1', 'region'], ['2', 'tabs'], ['3', 'stack']] as const) {
    bag.add(app.commands.register({
      id: `canvas.${layout}`,
      title: `Canvas: ${layout} layout`,
      slots: ['palette'],
      run: () => {
        app.surfaces.setState('canvas', { layout });
        app.store.set(LAYOUT_PATH, layout);
      },
    }));
    bag.add(app.keybindings.register({ keys: key, commandId: `canvas.${layout}` }));
  }

  return bag;
}
