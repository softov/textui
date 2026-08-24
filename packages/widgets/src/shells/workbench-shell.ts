import { defineComponent, h, useSize, useStoreValue, useTheme } from '@textui/core';
import { ToastHost } from '../overlay/index.js';
import { SurfaceArea } from '../surface/index.js';
import type { ShellProps } from './shared.js';
import { useSurfaceMounted } from './shared.js';

/**
 * Direction C: the workbench.
 *
 * A persistent frame - rail, sidebar, tabbed main, panel, status - inside a
 * rounded border. The richest shell, and the one that needs the most room, so
 * it declares a minimum size and the app falls back when the terminal is small.
 */
export const WorkbenchShell = defineComponent<ShellProps>('WorkbenchShell', (props) => {
  const theme = useTheme();
  const size = useSize();
  const sidebarCollapsed = useStoreValue<boolean>('$/ui/sidebar/collapsed', false);
  const asideVisible = useStoreValue<boolean>('$/ui/aside/visible', false);
  const sidebar = useSurfaceMounted('sidebar');
  const aside = useSurfaceMounted('aside');
  const narrow = size.width < 90;

  return h('box', {
    direction: 'column',
    width: '100%',
    height: '100%',
    bg: 'canvas',
    fg: 'text',
    border: theme.border,
    ...props,
  },
    h(SurfaceArea, { surface: 'header' }),

    h('box', { direction: 'row', flex: 1 },
      h(SurfaceArea, { surface: 'rail' }),

      sidebar && !sidebarCollapsed && !narrow
        ? h('box', {
            width: 24,
            border: { style: theme.border, sides: { right: true } },
            direction: 'column',
            padding: { left: 1 },
          }, h(SurfaceArea, { surface: 'sidebar', flex: 1 }))
        : null,

      h('box', { flex: 1, direction: 'column', padding: { left: 1 } },
        h(SurfaceArea, { surface: 'main', flex: 1 }),
        h(SurfaceArea, { surface: 'panel' })),

      aside && asideVisible && !narrow
        ? h('box', {
            width: 30,
            border: { style: theme.border, sides: { left: true } },
            direction: 'column',
            padding: { left: 1 },
          }, h(SurfaceArea, { surface: 'aside', flex: 1 }))
        : null),

    h(SurfaceArea, { surface: 'status' }),
    h(ToastHost, { anchor: 'bottom-right' }),
  );
});
