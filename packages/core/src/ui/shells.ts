import type { ComponentDefinition } from '../types/component-registry.js';
import type { ShellDefinition } from '../types/shell.js';
import type { BoxProps } from '../jsx/intrinsics.js';
import { h, defineComponent } from '../jsx/factory.js';
import { useSize, useStoreValue, useTheme } from '../runtime/hooks.js';
import { SurfaceArea } from './surface.js';
import { ToastHost } from './overlay.js';

/**
 * Shells.
 *
 * A shell decides where the surfaces go, and that is the whole of what it
 * decides. The three below are the same application in three house styles -
 * a dense bordered console, an airy report, and a workbench frame - and
 * nothing in the component catalog knows which one is mounted.
 *
 * That is the test the whole architecture exists to pass: if a shell needs a
 * component the others cannot use, the boundary is in the wrong place.
 */

export type ShellProps = BoxProps;

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
      !narrow && !sidebarCollapsed
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

      !sidebarCollapsed && !narrow
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

      asideVisible && !narrow
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

export const SHELL_COMPONENTS: ComponentDefinition[] = [
  { component: 'PlainShell', category: 'chrome', renderer: { kind: 'function', render: PlainShell }, description: 'Main and status, no frame.' },
  { component: 'ConsoleShell', category: 'chrome', renderer: { kind: 'function', render: ConsoleShell }, description: 'Dense bordered operator console.' },
  { component: 'PaperShell', category: 'chrome', renderer: { kind: 'function', render: PaperShell }, description: 'Airy and borderless.' },
  { component: 'WorkbenchShell', category: 'chrome', renderer: { kind: 'function', render: WorkbenchShell }, description: 'Full frame: rail, sidebar, tabs, panel, status.' },
];

export const BUILTIN_SHELLS: ShellDefinition[] = [
  {
    id: 'plain',
    title: 'Plain',
    description: 'Main and status only. The default.',
    component: 'PlainShell',
    surfaces: ['main', 'status', 'overlay', 'notify'],
  },
  {
    id: 'console',
    title: 'Console',
    description: 'Dense, bordered, every region labelled.',
    component: 'ConsoleShell',
    theme: 'console',
    surfaces: ['header', 'sidebar', 'main', 'panel', 'aside', 'status', 'overlay', 'notify'],
    minSize: { width: 60, height: 12 },
  },
  {
    id: 'paper',
    title: 'Paper',
    description: 'Borderless. Whitespace and alignment do the separating.',
    component: 'PaperShell',
    theme: 'paper',
    surfaces: ['header', 'main', 'panel', 'status', 'overlay', 'notify'],
    minSize: { width: 50, height: 10 },
  },
  {
    id: 'workbench',
    title: 'Workbench',
    description: 'Persistent frame with a rail, sidebar, tabs and a panel.',
    component: 'WorkbenchShell',
    theme: 'workbench',
    surfaces: ['header', 'rail', 'sidebar', 'main', 'panel', 'aside', 'status', 'overlay', 'notify'],
    minSize: { width: 80, height: 20 },
  },
];
