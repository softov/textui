import {
  Column, KeyValue, Panel, Row, Table, useRuntime, useState, useTicker,
} from '@textui/core';

/**
 * Stress.
 *
 * A thousand rows and a moving column, so the numbers at the bottom mean
 * something: `runs` is how many terminal writes the last frame cost. If a
 * redraw of one cell reports a hundred runs, the diff has stopped working.
 */
const SIZE = 1000;

export function StressPlayground() {
  const runtime = useRuntime();
  const app = runtime.app();
  const [tick, setTick] = useState(0);
  const [rows] = useState(() =>
    Array.from({ length: SIZE }, (_, i) => ({
      id: String(i),
      name: `service-${String(i).padStart(4, '0')}`,
      region: ['eu-west-1', 'us-east-1', 'sa-east-1'][i % 3] as string,
      status: (['up', 'degraded', 'down'] as const)[i % 3],
    })),
  );

  useTicker(() => setTick((n) => n + 1), { fps: 10 });

  const live = rows.map((row, i) => ({
    ...row,
    load: `${(Math.sin((i + tick) / 5) * 40 + 50).toFixed(0)}%`,
  }));

  const stats = app?.stats() ?? { renders: 0, runs: 0, instances: 0 };

  return (
    <Column flex={1} gap={1} padding={1}>
      <Panel title={`${SIZE} rows, one column changing every frame`} flex={1}>
        <Table
          columns={[
            { key: 'name', header: 'NAME', width: 20 },
            { key: 'region', header: 'REGION', width: 12, priority: 40 },
            { key: 'status', header: 'STATUS', width: 10, priority: 60 },
            { key: 'load', header: 'LOAD', width: 7, align: 'right', priority: 80 },
          ]}
          rows={live}
          visibleRows={14}
        />
      </Panel>

      <Panel title="Frame">
        <Row gap={3}>
          <KeyValue
            items={[
              { label: 'rows', value: String(SIZE) },
              { label: 'mounted', value: String(stats.instances) },
            ]}
          />
          <KeyValue
            items={[
              { label: 'renders', value: String(stats.renders) },
              { label: 'runs last frame', value: String(stats.runs), tone: stats.runs > 400 ? 'warning' : 'success' },
            ]}
          />
        </Row>
      </Panel>
    </Column>
  );
}
