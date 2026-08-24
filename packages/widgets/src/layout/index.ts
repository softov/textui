import type { ComponentDefinition } from '@textui/core';
import { Center } from './center.js';
import { Column } from './column.js';
import { Divider } from './divider.js';
import { Grid } from './grid.js';
import { Panel } from './panel.js';
import { Row } from './row.js';
import { ScrollView } from './scroll-view.js';
import { Splitter } from './splitter.js';
import { Stack } from './stack.js';

/**
 * Layout and containers.
 *
 * Every one of these is `box` with an opinion. That is the point: the layout
 * engine only ever sees the primitive, so a new container costs a function
 * rather than a new case in the engine.
 */
export * from './center.js';
export * from './column.js';
export * from './divider.js';
export * from './grid.js';
export * from './panel.js';
export * from './row.js';
export * from './scroll-view.js';
export * from './splitter.js';
export * from './stack.js';

export const LAYOUT_COMPONENTS: ComponentDefinition[] = [
  { component: 'Row', category: 'layout', renderer: { kind: 'function', render: Row }, description: 'Horizontal flex container.' },
  { component: 'Column', category: 'layout', renderer: { kind: 'function', render: Column }, description: 'Vertical flex container.' },
  { component: 'Center', category: 'layout', renderer: { kind: 'function', render: Center }, description: 'Centres its children.' },
  { component: 'Grid', category: 'layout', renderer: { kind: 'function', render: Grid }, description: 'Equal-width columns, wrapping into rows.' },
  { component: 'Panel', category: 'layout', renderer: { kind: 'function', render: Panel }, description: 'Titled region. Bordered or airy, following the theme.', variants: ['bordered', 'plain'], role: 'region' },
  { component: 'Divider', category: 'layout', renderer: { kind: 'function', render: Divider }, description: 'A rule, optionally labelled.', role: 'separator' },
  { component: 'Stack', category: 'layout', renderer: { kind: 'function', render: Stack }, description: 'Column with themed spacing.' },
  { component: 'ScrollView', category: 'layout', renderer: { kind: 'function', render: ScrollView }, description: 'Scrolling viewport with keyboard and wheel support.' },
  { component: 'Splitter', category: 'layout', renderer: { kind: 'function', render: Splitter }, description: 'Two panes with a divider.' },
];
