import { useStoreValue } from '@textui/core';
import {
  AreaChart,
  BarChart,
  Column,
  Gauge,
  Grid,
  Heatmap,
  Histogram,
  LineChart,
  Panel,
  Row,
  Sparkline,
} from '@textui/widgets';
import { wave } from '../data.js';

/**
 * Charts.
 *
 * Every one of these states its numbers as well as its shape, and every one
 * degrades: with `unicode: 'ascii'` the braille plot becomes blocks and the
 * blocks become punctuation, and all of them still read.
 */
export function ChartsPlayground() {
  const cpu = useStoreValue<number[]>('$/metrics/cpu/history', []) ?? [];
  const latency = useStoreValue<number[]>('$/metrics/latency/history', []) ?? [];
  const network = useStoreValue<number[]>('$/metrics/network/history', []) ?? [];
  const grid = useStoreValue<number[][]>('$/metrics/errors/grid', []) ?? [];

  return (
    <Column flex={1} gap={1} padding={1}>
      <Panel title="Sparklines">
        <Column gap={0}>
          <Row gap={1}><text content="cpu    " fg="muted" /><Sparkline values={cpu} chartWidth={40} showValue /></Row>
          <Row gap={1}><text content="latency" fg="muted" /><Sparkline values={latency} chartWidth={40} tone="warning" showValue /></Row>
          <Row gap={1}><text content="network" fg="muted" /><Sparkline values={network} chartWidth={40} tone="secondary" showValue /></Row>
        </Column>
      </Panel>

      <Row gap={2}>
        <Gauge label="CPU" value={cpu.at(-1) ?? 0} thresholds={[{ at: 80, tone: 'danger' }, { at: 50, tone: 'warning' }]} />
        <Gauge label="P95" value={latency.at(-1) ?? 0} max={400} format={(v) => `${v}ms`} />
      </Row>

      <Grid columns={2} gap={1} flex={1}>
        <Panel title="Line">
          <LineChart series={[{ values: cpu, label: 'cpu' }]} chartHeight={6} />
        </Panel>

        <Panel title="Area">
          <AreaChart series={[{ values: latency, label: 'p95', tone: 'warning' }]} chartHeight={6} />
        </Panel>

        <Panel title="Bars">
          <BarChart
            data={[
              { label: 'api', value: 1284 },
              { label: 'auth', value: 212 },
              { label: 'search', value: 903 },
              { label: 'cache', value: 8410 },
            ]}
            barWidth={16}
          />
        </Panel>

        <Panel title="Histogram">
          <Histogram values={wave(120, 2, 60, 50)} buckets={10} chartHeight={5} />
        </Panel>
      </Grid>

      <Panel title="Heatmap">
        <Heatmap data={grid} rowLabels={['mon', 'tue', 'wed', 'thu', 'fri']} />
      </Panel>
    </Column>
  );
}
