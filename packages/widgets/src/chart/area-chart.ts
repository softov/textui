import { defineComponent, h } from '@textui/core';
import { LineChart } from './line-chart.js';
import type { LineChartProps } from './shared.js';

export type AreaChartProps = LineChartProps;

export const AreaChart = defineComponent<AreaChartProps>('AreaChart', (props) =>
  h(LineChart, { area: true, ...props }),
);
