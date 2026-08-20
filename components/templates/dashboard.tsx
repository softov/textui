import {
  Column, KeyHints, Panel, Row, StatusDot, defineComponent,
  useStoreValue, useTicker, useState,
} from '@textui/core';
import { ServiceTable, type Service } from '../ui/service-table.js';
import { MetricCard } from '../ui/metric-card.js';

/**
 * A service dashboard.
 *
 * Everything on screen reads from the store, so the data can come from a
 * poller, a socket or a fixture without this file changing. Replace the
 * `useDemoData` hook with a data provider and nothing else moves.
 */
export function Dashboard() {
  const services = useStoreValue<Service[]>('$/services/list', []) ?? [];
  const cpu = useStoreValue<number[]>('$/metrics/cpu/history', []) ?? [];
  const memory = useStoreValue<number[]>('$/metrics/memory/history', []) ?? [];
  const [selected, setSelected] = useState<string | undefined>(undefined);

  const up = services.filter((s) => s.status === 'up').length;
  const degraded = services.filter((s) => s.status === 'degraded').length;
  const down = services.filter((s) => s.status === 'down').length;

  return (
    <Column flex={1} gap={1} padding={1}>
      <Row gap={3}>
        <MetricCard label="CPU" value={cpu.at(-1) ?? 0} unit="%" history={cpu} tone="accent" />
        <MetricCard label="MEMORY" value={memory.at(-1) ?? 0} unit="%" history={memory} tone="secondary" />
        <MetricCard label="SERVICES" value={services.length} unit="total" />
        <Column>
          <StatusDot status="up" label={`${up} up`} />
          <StatusDot status="degraded" label={`${degraded} degraded`} />
          <StatusDot status="down" label={`${down} down`} />
        </Column>
      </Row>

      <Panel title="Services" meta={`${services.length}`} flex={1}>
        <ServiceTable
          services={services}
          selectedId={selected}
          onSelect={setSelected}
          visibleRows={10}
        />
      </Panel>

      <KeyHints
        hints={[
          { keys: 'up/down', label: 'move' },
          { keys: 'enter', label: 'open' },
          { keys: '/', label: 'search' },
          { keys: ':', label: 'command' },
          { keys: 'q', label: 'quit' },
        ]}
      />
    </Column>
  );
}

/** Fake data, so the template runs the moment it is copied. */
export function useDemoData() {
  const [tick, setTick] = useState(0);
  useTicker(() => setTick((n) => n + 1), { fps: 2 });
  return tick;
}

export default defineComponent('Dashboard', Dashboard);
