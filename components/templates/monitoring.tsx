import {
  AreaChart, Column, Gauge, Grid, Heatmap, Panel, Row, Timeline,
  defineComponent, useStoreValue,
} from '@textui/core';
import { ServiceTable, type Service } from '../ui/service-table.js';

/**
 * A monitoring console.
 *
 * Every chart states its numbers as well as its shape. A sparkline with no
 * scale is decoration, and decoration is what you are looking at when the page
 * is telling you something is wrong.
 */
export function MonitoringScreen() {
  const services = useStoreValue<Service[]>('$/services/list', []) ?? [];
  const cpu = useStoreValue<number[]>('$/metrics/cpu/history', []) ?? [];
  const latency = useStoreValue<number[]>('$/metrics/latency/history', []) ?? [];
  const errors = useStoreValue<number[][]>('$/metrics/errors/grid', []) ?? [];
  const events = useStoreValue<{ time: string; title: string; description?: string; tone?: 'warning' | 'danger' | 'success' }[]>(
    '$/events/list', [],
  ) ?? [];

  return (
    <Column flex={1} gap={1} padding={1}>
      <Row gap={2}>
        <Gauge label="CPU" value={cpu.at(-1) ?? 0} thresholds={[{ at: 80, tone: 'danger' }, { at: 50, tone: 'warning' }]} />
        <Gauge label="P95" value={latency.at(-1) ?? 0} max={500} format={(v) => `${v}ms`} thresholds={[{ at: 300, tone: 'danger' }]} />
      </Row>

      <Grid columns={2} gap={1} flex={1}>
        <Panel title="CPU">
          <AreaChart series={[{ values: cpu, label: 'cpu %' }]} chartHeight={6} />
        </Panel>

        <Panel title="Latency">
          <AreaChart series={[{ values: latency, label: 'p95 ms', tone: 'warning' }]} chartHeight={6} />
        </Panel>

        <Panel title="Errors by hour">
          <Heatmap
            data={errors}
            rowLabels={['mon', 'tue', 'wed', 'thu', 'fri']}
          />
        </Panel>

        <Panel title="Recent events">
          <Timeline items={events} />
        </Panel>
      </Grid>

      <Panel title="Services" meta={`${services.length}`}>
        <ServiceTable services={services} visibleRows={6} />
      </Panel>
    </Column>
  );
}

export default defineComponent('MonitoringScreen', MonitoringScreen);
