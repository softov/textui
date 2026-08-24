import type { BindingPath, BoxProps, ComponentNode, SurfaceName } from '@textui/core';
import { defineComponent, h, useRuntime, useStoreSubtree } from '@textui/core';

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
