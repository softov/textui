import { defineComponent, h } from '@textui/core';
import { ToastHost } from '../overlay/index.js';
import { SurfaceArea } from '../surface/index.js';
import type { ShellProps } from './shared.js';

/** No chrome at all: `main` fills the terminal. For a single-screen tool. */
export const PlainShell = defineComponent<ShellProps>('PlainShell', (props) =>
  h('box', {
    direction: 'column', width: '100%', height: '100%',
    // Ink as well as page: a themed background with the terminal's own
    // foreground on top is how a light theme comes out white on white.
    bg: 'canvas', fg: 'text',
    ...props,
  },
    h(SurfaceArea, { surface: 'main', flex: 1 }),
    h(SurfaceArea, { surface: 'status' }),
    h(ToastHost, { anchor: 'bottom-right' }),
  ),
);
