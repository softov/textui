import { useStoreValue, useState } from '@textui/core';
import { Column, LogViewer, Panel, Row, SearchBox, Table, Tree } from '@textui/widgets';
import type { LogLine, Service } from '../data.js';

/**
 * Data components.
 *
 * The table's column priorities are the thing to watch here: narrow the
 * terminal and it sheds memory, then uptime, then request rate - and never the
 * name, because a row you cannot identify is not a smaller row.
 */
export function DataPlayground() {
  const services = useStoreValue<Service[]>('$/services/list', []) ?? [];
  const logs = useStoreValue<LogLine[]>('$/logs/lines', []) ?? [];
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | undefined>(undefined);

  const filtered = services.filter((s) =>
    query === '' || s.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <Column flex={1} gap={1} padding={1}>
      <SearchBox value={query} onChange={setQuery} placeholder="Filter services" count={filtered.length} />

      <Panel title="Table" meta="narrow the terminal to see columns drop">
        <Table
          columns={[
            { key: 'name', header: 'NAME', width: 18 },
            { key: 'status', header: 'STATUS', width: 10, priority: 90 },
            { key: 'cpu', header: 'CPU', width: 7, align: 'right', priority: 60, format: (v) => `${v as number}%` },
            { key: 'requestsPerSecond', header: 'REQ/S', width: 8, align: 'right', priority: 40 },
            { key: 'uptime', header: 'UPTIME', width: 9, align: 'right', priority: 20 },
            { key: 'memory', header: 'MEM', width: 8, align: 'right', priority: 10 },
          ]}
          rows={filtered}
          selectedKey={selected}
          onSelect={setSelected}
          visibleRows={7}
        />
      </Panel>

      <Row gap={1} flex={1}>
        <Panel title="Tree" width={34}>
          <Tree
            nodes={[
              {
                id: 'prod',
                label: 'production',
                children: services.map((s) => ({ id: `prod/${s.id}`, label: s.name, meta: s.status })),
              },
              { id: 'staging', label: 'staging', hasChildren: true },
            ]}
            visibleRows={8}
          />
        </Panel>

        <Panel title="Log" flex={1}>
          <LogViewer lines={logs} visibleRows={8} />
        </Panel>
      </Row>
    </Column>
  );
}
