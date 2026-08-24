import type { BoxProps, Mount, SurfaceName, SurfaceState } from '@textui/core';

export interface LayoutProps extends BoxProps {
  surface: SurfaceName;
  mounts: Mount[];
  state: SurfaceState;
}
