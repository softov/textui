import type { ComponentDefinition } from '@textui/core';
import { BarLayout } from './bar-layout.js';
import { InlineLayout } from './inline-layout.js';
import { MountView } from './mount-view.js';
import { RailLayout } from './rail-layout.js';
import { SingleLayout } from './single-layout.js';
import { SplitLayout } from './split-layout.js';
import { StackLayout } from './stack-layout.js';
import { SurfaceArea } from './surface-area.js';
import { TabsLayout } from './tabs-layout.js';

/**
 * Surfaces, mounts and layouts.
 *
 * `SurfaceArea` is the only bridge between the registries and the render tree:
 * it reads a surface's mounts and its state, then hands both to whichever
 * layout that surface is currently using. Because the layout is store state
 * rather than code, a sidebar can be tabs now and a stack a keystroke later.
 */
export * from './bar-layout.js';
export * from './inline-layout.js';
export * from './mount-view.js';
export * from './rail-layout.js';
export * from './single-layout.js';
export * from './split-layout.js';
export * from './stack-layout.js';
export * from './surface-area.js';
export * from './tabs-layout.js';
export type { LayoutProps } from './shared.js';

export const SURFACE_COMPONENTS: ComponentDefinition[] = [
  { component: 'SurfaceArea', category: 'chrome', renderer: { kind: 'function', render: SurfaceArea }, description: 'Renders one surface through its active layout.' },
  { component: 'MountView', category: 'chrome', renderer: { kind: 'function', render: MountView }, description: 'Renders one mount target.' },
  { component: 'SingleLayout', category: 'chrome', renderer: { kind: 'function', render: SingleLayout }, description: 'Only the active mount.' },
  { component: 'TabsLayout', category: 'chrome', renderer: { kind: 'function', render: TabsLayout }, description: 'Tab strip plus the active mount.' },
  { component: 'StackLayout', category: 'chrome', renderer: { kind: 'function', render: StackLayout }, description: 'All mounts, stacked with headings.' },
  { component: 'SplitLayout', category: 'chrome', renderer: { kind: 'function', render: SplitLayout }, description: 'All mounts, side by side.' },
  { component: 'BarLayout', category: 'chrome', renderer: { kind: 'function', render: BarLayout }, description: 'All mounts on one line.' },
  { component: 'RailLayout', category: 'chrome', renderer: { kind: 'function', render: RailLayout }, description: 'Icons only.' },
  { component: 'InlineLayout', category: 'chrome', renderer: { kind: 'function', render: InlineLayout }, description: 'All mounts, no chrome.' },
];

export const BUILTIN_LAYOUTS = [
  { name: 'single' as const, component: 'SingleLayout', title: 'Single' },
  { name: 'tabs' as const, component: 'TabsLayout', title: 'Tabs' },
  { name: 'stack' as const, component: 'StackLayout', title: 'Stack' },
  { name: 'split' as const, component: 'SplitLayout', title: 'Split' },
  { name: 'bar' as const, component: 'BarLayout', title: 'Bar' },
  { name: 'rail' as const, component: 'RailLayout', title: 'Rail' },
  { name: 'inline' as const, component: 'InlineLayout', title: 'Inline' },
  { name: 'floating' as const, component: 'InlineLayout', title: 'Floating' },
  { name: 'toast' as const, component: 'StackLayout', title: 'Toast' },
];
