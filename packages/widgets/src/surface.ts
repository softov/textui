import type {
  ComponentDefinition,
  BoxProps,
  Mount,
  SurfaceName,
  SurfaceState,
  ComponentNode,
  BindingPath,
} from '@textui/core';
import { h, defineComponent, useRuntime, useStoreSubtree, useTheme } from '@textui/core';
import { Tabs } from './navigation.js';
import { EmptyState } from './display.js';

/**
 * Surfaces, mounts and layouts.
 *
 * `SurfaceArea` is the only bridge between the registries and the render tree:
 * it reads a surface's mounts and its state, then hands both to whichever
 * layout that surface is currently using. Because the layout is store state
 * rather than code, a sidebar can be tabs now and a stack a keystroke later.
 */

export interface MountViewProps extends BoxProps {
  mount: Mount;
}

/** Renders one mount's target - an inline node, or a node read from a path. */
export const MountView = defineComponent<MountViewProps>('MountView', ({ mount, ...rest }) => {
  const runtime = useRuntime();

  const target = mount.target;
  const node: ComponentNode | null =
    'component' in target
      ? target
      : (runtime.store.get<ComponentNode>((target as { path: BindingPath }).path) ?? null);

  if (!node) {
    return h(EmptyState, { title: 'Nothing mounted', ...rest });
  }

  // A mount's data context makes relative paths inside it resolve against the
  // record it was opened for.
  const withContext = mount.dataContext
    ? { ...node, dataContext: mount.dataContext }
    : node;

  return h('box', { flex: 1, direction: 'column', ...rest }, withContext);
});

export interface LayoutProps extends BoxProps {
  surface: SurfaceName;
  mounts: Mount[];
  state: SurfaceState;
}

/** Only the active mount. */
export const SingleLayout = defineComponent<LayoutProps>('SingleLayout', (props) => {
  const { mounts, state, surface: _surface, ...rest } = props;
  const active = mounts.find((m) => m.key === state.activeKey) ?? mounts[0];
  if (!active) return null;

  // A mount that declares a title gets one drawn, the same rule `stack`
  // follows. It matters more here: `stack` shows everything at once, so which
  // panel you are looking at is never a question, and this one shows one of
  // several and answers it no other way.
  if (active.display?.title === undefined) return h(MountView, { mount: active, ...rest });
  return h('box', { direction: 'column', flex: 1, ...rest },
    h('box', { direction: 'row', gap: 1 },
      h('text', { content: active.display.title, bold: true, fg: 'muted' }),
      active.display.badge !== undefined
        ? h('text', { content: String(active.display.badge), fg: 'subtle' })
        : null,
      h('spacer', { flex: 1 })),
    h(MountView, { mount: active, flex: 1 }),
  );
});

/** A tab strip and the active mount. */
export const TabsLayout = defineComponent<LayoutProps>('TabsLayout', (props) => {
  const runtime = useRuntime();
  const { mounts, state, surface, ...rest } = props;
  if (mounts.length === 0) return null;

  const active = mounts.find((m) => m.key === state.activeKey) ?? mounts[0];
  const app = runtime.app();

  return h('box', { direction: 'column', flex: 1, ...rest },
    mounts.length > 1
      ? h(Tabs, {
          items: mounts.map((m) => ({
            id: m.key,
            label: m.display?.title ?? m.key,
            icon: m.display?.icon,
            badge: m.display?.badge,
          })),
          activeId: active?.key,
          onChange: (key: string) => app?.surfaces.activate(surface, key),
        })
      : null,
    active ? h(MountView, { mount: active, flex: 1 }) : null,
  );
});

/** Every mount, stacked, each under its own heading. */
export const StackLayout = defineComponent<LayoutProps>('StackLayout', (props) => {
  const theme = useTheme();
  const { mounts, surface: _surface, state: _state, ...rest } = props;

  return h('box', { direction: 'column', flex: 1, ...rest },
    ...mounts.map((mount, i) =>
      // Each mount fills its share of the surface rather than only what its
      // own content needs. A content-sized wrapper hands a viewport no height
      // to measure, and a tree inside one reports a rect of 3 rows in a
      // twenty-row sidebar - or of 0, once its content overflows.
      h('box', { key: mount.key, direction: 'column', flex: 1 },
        mount.display?.title
          ? h('box', { direction: 'row', gap: 1 },
              h('text', { content: mount.display.title, bold: true, fg: 'muted' }),
              mount.display.badge !== undefined
                ? h('text', { content: String(mount.display.badge), fg: 'subtle' })
                : null,
              h('spacer', { flex: 1 }))
          : null,
        h(MountView, { mount }),
        // A rule separates two mounts. After the last one it separates a mount
        // from nothing, which is a line under a sidebar with one panel in it.
        i < mounts.length - 1
          ? h('box', { height: 1, fill: theme.borderChars().top, fg: 'borderSubtle' })
          : null)),
  );
});

/** Every mount, side by side, sharing the space. */
export const SplitLayout = defineComponent<LayoutProps>('SplitLayout', (props) => {
  const { mounts, surface: _surface, state: _state, direction = 'row', ...rest } = props;
  return h('box', { direction, flex: 1, gap: 1, ...rest },
    ...mounts.map((mount) => h(MountView, { key: mount.key, mount, flex: 1 })),
  );
});

/** Every mount on one line. Headers and status bars use this. */
export const BarLayout = defineComponent<LayoutProps>('BarLayout', (props) => {
  const { mounts, surface: _surface, state: _state, ...rest } = props;
  return h('box', { direction: 'row', height: 1, gap: 2, ...rest },
    ...mounts.map((mount) => h(MountView, { key: mount.key, mount })),
  );
});

/** Icons only, one per mount. An activity bar. */
export const RailLayout = defineComponent<LayoutProps>('RailLayout', (props) => {
  const runtime = useRuntime();
  const theme = useTheme();
  const { mounts, state, surface, ...rest } = props;
  const app = runtime.app();

  return h('box', { direction: 'column', width: 3, align: 'center', ...rest },
    ...mounts.map((mount) => {
      const active = mount.key === state.activeKey;
      return h('box', {
        key: mount.key,
        direction: 'row',
        gap: 0,
        fg: active ? 'accent' : 'muted',
        bold: active,
        onClick: () => app?.surfaces.activate(surface, mount.key),
      },
        h('text', { content: active ? theme.glyphs.chevronRight : ' ' }),
        h('text', { content: mount.display?.icon ?? mount.key.slice(0, 1).toUpperCase() }),
      );
    }),
  );
});

/** Every mount, no chrome at all. */
export const InlineLayout = defineComponent<LayoutProps>('InlineLayout', (props) => {
  const { mounts, surface: _surface, state: _state, ...rest } = props;
  return h('box', { direction: 'column', flex: 1, ...rest },
    ...mounts.map((mount) => h(MountView, { key: mount.key, mount })),
  );
});

export interface SurfaceAreaProps extends BoxProps {
  surface: SurfaceName;
  /** Override the surface's stored layout. */
  layout?: string;
  /** Rendered when the surface has no visible mounts. */
  fallback?: ComponentNode;
}

/**
 * Render one surface through its active layout.
 *
 * This subscribes to the surface's state and mount list rather than to the
 * whole store, so opening a tab in `main` does not re-render the status bar.
 */
export const SurfaceArea = defineComponent<SurfaceAreaProps>('SurfaceArea', (props) => {
  const runtime = useRuntime();
  const { surface, layout: layoutOverride, fallback, ...rest } = props;

  // Subscribing to both paths is what makes a surface reactive.
  useStoreSubtree(`$/layout/surfaces/${surface}` as BindingPath);
  useStoreSubtree(`$/layout/mounts/${surface}` as BindingPath);

  const app = runtime.app();
  if (!app) return null;

  const state = app.surfaces.state(surface);
  if (!state.visible || state.collapsed) return null;

  const mounts = app.surfaces.mounts(surface);
  if (mounts.length === 0) return fallback ? h('box', { ...rest }, fallback) : null;

  const layoutName = layoutOverride ?? state.layout;
  const definition = app.layouts.get(layoutName);

  if (!definition) {
    return h('text', {
      content: `[textui] no layout registered as "${layoutName}"`,
      fg: 'danger',
    });
  }

  return h(definition.component, { surface, mounts, state, ...rest });
});

export const SURFACE_COMPONENTS: ComponentDefinition[] = [
  { component: 'SurfaceArea', category: 'chrome', renderer: { kind: 'function', render: SurfaceArea }, description: 'Renders one surface through its active layout.' },
  { component: 'MountView', category: 'chrome', renderer: { kind: 'function', render: MountView }, description: 'Renders one mount target.' },
  { component: 'SingleLayout', category: 'chrome', renderer: { kind: 'function', render: SingleLayout }, description: 'Only the active mount.' },
  { component: 'TabsLayout', category: 'chrome', renderer: { kind: 'function', render: TabsLayout }, description: 'Tab strip plus the active mount.' },
  { component: 'StackLayout', category: 'chrome', renderer: { kind: 'function', render: StackLayout }, description: 'All mounts, stacked with headings.' },
  { component: 'SplitLayout', category: 'chrome', renderer: { kind: 'function', render: SplitLayout }, description: 'All mounts, side by side.' },
  { component: 'BarLayout', category: 'chrome', renderer: { kind: 'function', render: BarLayout }, description: 'All mounts on one line.' },
  { component: 'RailLayout', category: 'chrome', renderer: { kind: 'function', render: RailLayout }, description: 'Icons only.' },
  { component: 'InlineLayout', category: 'chrome', renderer: { kind: 'function', render: InlineLayout }, description: 'All mounts, no chrome.' },
];

export const BUILTIN_LAYOUTS = [
  { name: 'single' as const, component: 'SingleLayout', title: 'Single' },
  { name: 'tabs' as const, component: 'TabsLayout', title: 'Tabs' },
  { name: 'stack' as const, component: 'StackLayout', title: 'Stack' },
  { name: 'split' as const, component: 'SplitLayout', title: 'Split' },
  { name: 'bar' as const, component: 'BarLayout', title: 'Bar' },
  { name: 'rail' as const, component: 'RailLayout', title: 'Rail' },
  { name: 'inline' as const, component: 'InlineLayout', title: 'Inline' },
  { name: 'floating' as const, component: 'InlineLayout', title: 'Floating' },
  { name: 'toast' as const, component: 'StackLayout', title: 'Toast' },
];
