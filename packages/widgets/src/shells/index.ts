import type { ComponentDefinition, ShellDefinition } from '@textui/core';
import { ConsoleShell } from './console-shell.js';
import { PaperShell } from './paper-shell.js';
import { PlainShell } from './plain-shell.js';
import { WorkbenchShell } from './workbench-shell.js';

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
export * from './console-shell.js';
export * from './paper-shell.js';
export * from './plain-shell.js';
export * from './workbench-shell.js';
export type { ShellProps } from './shared.js';

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
