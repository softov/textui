import type { ComponentDefinition } from '@textui/core';
import { Breadcrumb } from './breadcrumb.js';
import { KeyHints } from './key-hints.js';
import { Menu } from './menu.js';
import { StatusBar } from './status-bar.js';
import { Tabs } from './tabs.js';
import { Toolbar } from './toolbar.js';
import { Wizard } from './wizard.js';

/**
 * Navigation chrome.
 *
 * These are the components a shell is made of, which is why they all take
 * their own items rather than reading a surface: the same `Tabs` serves a tab
 * strip in a workbench and a segmented control inside a panel.
 */
export * from './breadcrumb.js';
export * from './key-hints.js';
export * from './menu.js';
export * from './status-bar.js';
export * from './tabs.js';
export * from './toolbar.js';
export * from './wizard.js';

export const NAVIGATION_COMPONENTS: ComponentDefinition[] = [
  { component: 'Tabs', category: 'navigation', renderer: { kind: 'function', render: Tabs }, role: 'tablist', variants: ['underline', 'solid', 'plain'], description: 'Tab strip or segmented control.' },
  { component: 'Breadcrumb', category: 'navigation', renderer: { kind: 'function', render: Breadcrumb }, role: 'navigation', description: 'Where you are, collapsing in the middle when narrow.' },
  { component: 'Menu', category: 'navigation', renderer: { kind: 'function', render: Menu }, role: 'menu', description: 'Keyboard-driven list of actions.' },
  { component: 'StatusBar', category: 'chrome', renderer: { kind: 'function', render: StatusBar }, role: 'contentinfo', description: 'One line, segments left and right.' },
  { component: 'Toolbar', category: 'chrome', renderer: { kind: 'function', render: Toolbar }, role: 'toolbar', description: 'A row of actions.' },
  { component: 'KeyHints', category: 'chrome', renderer: { kind: 'function', render: KeyHints }, description: 'What the keys do, right now.' },
  { component: 'Wizard', category: 'navigation', renderer: { kind: 'function', render: Wizard }, description: 'Ordered steps with progress.' },
];
