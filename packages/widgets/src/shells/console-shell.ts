import { defineComponent, h, useSize, useStoreValue, useTheme } from '@textui/core';
import { ToastHost } from '../overlay/index.js';
import { SurfaceArea } from '../surface/index.js';
import type { ShellProps } from './shared.js';
import { useSurfaceMounted } from './shared.js';

/**
 * Direction A: the dense operator console.
 *
 * Every region is a labelled box, chrome carries counts, nothing is wasted.
 * Sidebar left, panel bottom, one-line status.
 */
export const ConsoleShell = defineComponent<ShellProps>('ConsoleShell', (props) => {
  const theme = useTheme();
  const size = useSize();
  const sidebarCollapsed = useStoreValue<boolean>('$/ui/sidebar/collapsed', false);
  const sidebar = useSurfaceMounted('sidebar');
  const narrow = size.width < 80;

  return h('box', {
    direction: 'column', width: '100%', height: '100%',
    // Ink as well as page: a themed background with the terminal's own
    // foreground on top is how a light theme comes out white on white.
    bg: 'canvas', fg: 'text',
    ...props,
  },
    h(SurfaceArea, { surface: 'header' }),

    h('box', { direction: 'row', flex: 1 },
      sidebar && !narrow && !sidebarCollapsed
        ? h('box', {
            width: 18,
            border: { style: theme.border, sides: { right: true } },
            direction: 'column',
          }, h(SurfaceArea, { surface: 'sidebar', flex: 1 }))
        : null,

      h('box', { flex: 1, direction: 'column' },
        h(SurfaceArea, { surface: 'main', flex: 1 }),
        h(SurfaceArea, { surface: 'panel' })),

      !narrow ? h(SurfaceArea, { surface: 'aside' }) : null),

    h(SurfaceArea, { surface: 'status' }),
    h(ToastHost, { anchor: 'bottom-right' }),
  );
});
