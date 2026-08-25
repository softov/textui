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
  const showSidebar = Boolean(sidebar) && !sidebarCollapsed && !narrow;
  const showAside = Boolean(aside) && asideVisible && !narrow;

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

      showSidebar
        ? h('box', {
            width: 24,
            border: { style: theme.border, sides: { right: true } },
            direction: 'column',
            padding: { left: 1 },
          }, h(SurfaceArea, { surface: 'sidebar', flex: 1 }))
        : null,

      // A gutter separates main from the pane beside it, so it belongs on the
      // sides that have one. Applied unconditionally it insets every screen by
      // a cell on the left and nothing on the right - hidden under a theme
      // that draws a frame, and plainly lopsided under one that does not.
      h('box', {
        flex: 1,
        direction: 'column',
        padding: {
          ...(showSidebar ? { left: 1 } : {}),
          ...(showAside ? { right: 1 } : {}),
        },
      },
        h(SurfaceArea, { surface: 'main', flex: 1 }),
        h(SurfaceArea, { surface: 'panel' })),

      showAside
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
