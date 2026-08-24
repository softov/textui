import type { ComponentDefinition } from '@textui/core';
import { AreaChart } from './area-chart.js';
import { BarChart } from './bar-chart.js';
import { Gauge } from './gauge.js';
import { Heatmap } from './heatmap.js';
import { Histogram } from './histogram.js';
import { LineChart } from './line-chart.js';
import { Sparkline } from './sparkline.js';

/**
 * Charts.
 *
 * A terminal chart has one cell of resolution vertically and one horizontally,
 * so the honest approach is to pick glyphs that subdivide a cell - eight block
 * levels, four braille dots - rather than to pretend at pixel plotting. Every
 * chart here also states its numbers, because a shape without a scale is
 * decoration.
 */
export * from './area-chart.js';
export * from './bar-chart.js';
export * from './gauge.js';
export * from './heatmap.js';
export * from './histogram.js';
export * from './line-chart.js';
export * from './sparkline.js';
export type { LineChartProps, Series } from './shared.js';

export const CHART_COMPONENTS: ComponentDefinition[] = [
  { component: 'Sparkline', category: 'chart', renderer: { kind: 'function', render: Sparkline }, description: 'One row of block glyphs; eight levels per cell.' },
  { component: 'BarChart', category: 'chart', renderer: { kind: 'function', render: BarChart }, description: 'Labelled bars, horizontal or vertical.' },
  { component: 'LineChart', category: 'chart', renderer: { kind: 'function', render: LineChart }, description: 'Braille plot at 2x4 the cell resolution.' },
  { component: 'AreaChart', category: 'chart', renderer: { kind: 'function', render: AreaChart }, description: 'A line chart, filled.' },
  { component: 'Histogram', category: 'chart', renderer: { kind: 'function', render: Histogram }, description: 'Bucketed distribution.' },
  { component: 'Gauge', category: 'chart', renderer: { kind: 'function', render: Gauge }, role: 'meter', description: 'A reading against thresholds.' },
  { component: 'Heatmap', category: 'chart', renderer: { kind: 'function', render: Heatmap }, description: 'A grid of intensities.' },
];
