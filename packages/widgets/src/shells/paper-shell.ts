import { defineComponent, h, useTheme } from '@textui/core';
import { ToastHost } from '../overlay/index.js';
import { SurfaceArea } from '../surface/index.js';
import type { ShellProps } from './shared.js';

/**
 * Direction B: airy and borderless.
 *
 * Whitespace does the separating; there is no frame, and the surfaces that
 * would be chrome elsewhere are simply spaced sections. Also the shell that
 * reads best when the output is piped to a file.
 */
export const PaperShell = defineComponent<ShellProps>('PaperShell', (props) => {
  const theme = useTheme();
  return h('box', {
    direction: 'column',
    width: '100%',
    height: '100%',
    bg: 'canvas',
    fg: 'text',
    padding: [1, theme.spacing.md],
    gap: 1,
    ...props,
  },
    h(SurfaceArea, { surface: 'header' }),
    h(SurfaceArea, { surface: 'main', flex: 1 }),
    h(SurfaceArea, { surface: 'panel' }),
    h(SurfaceArea, { surface: 'status' }),
    h(ToastHost, { anchor: 'bottom' }),
  );
});
