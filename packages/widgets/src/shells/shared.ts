import type { BindingPath, BoxProps, SurfaceName } from '@textui/core';
import { useRuntime, useStoreSubtree } from '@textui/core';

export type ShellProps = BoxProps;

/**
 * Whether a surface has anything to show.
 *
 * `SurfaceArea` already renders nothing for an empty surface, but a region
 * with a fixed width reserves its column either way - which is how an
 * application that never mounts a sidebar still gets an empty gutter down the
 * left of every screen. A shell has to ask before it spends the space.
 */
export function useSurfaceMounted(surface: SurfaceName): boolean {
  const runtime = useRuntime();
  useStoreSubtree(`$/layout/surfaces/${surface}` as BindingPath);
  useStoreSubtree(`$/layout/mounts/${surface}` as BindingPath);

  const app = runtime.app();
  if (!app) return false;
  const state = app.surfaces.state(surface);
  if (!state.visible || state.collapsed) return false;
  return app.surfaces.mounts(surface).length > 0;
}
