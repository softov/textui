import { Table, defineComponent, type BoxProps } from '@textui/core';
import type { Status } from './status-dot.js';

/**
 * The table this project's dashboards agree on.
 *
 * Column priorities are the interesting part: as the table narrows it drops
 * memory, then uptime, then request rate - never the name, which is what
 * identifies the row. Edit the priorities, not the layout engine.
 */
export interface Service {
  id: string;
  name: string;
  status: Status;
  cpu?: number;
  memory?: string;
  uptime?: string;
  requestsPerSecond?: number;
}

export interface ServiceTableProps extends BoxProps {
  services: Service[];
  selectedId?: string;
  onSelect?(id: string): void;
  onActivate?(id: string): void;
  visibleRows?: number;
}

export function ServiceTable({
  services, selectedId, onSelect, onActivate, visibleRows, ...rest
}: ServiceTableProps) {
  return (
    <Table
      columns={[
        { key: 'name', header: 'NAME', width: 18 },
        { key: 'status', header: 'STATUS', width: 10, priority: 90 },
        { key: 'cpu', header: 'CPU', width: 7, align: 'right', priority: 60, format: (v: unknown) => (v === undefined ? '-' : `${v}%`) },
        { key: 'requestsPerSecond', header: 'REQ/S', width: 8, align: 'right', priority: 40, format: (v: unknown) => (v === undefined ? '-' : String(v)) },
        { key: 'uptime', header: 'UPTIME', width: 9, align: 'right', priority: 20 },
        { key: 'memory', header: 'MEM', width: 8, align: 'right', priority: 10 },
      ]}
      rows={services}
      rowKey="id"
      selectedKey={selectedId}
      onSelect={onSelect}
      onActivate={onActivate}
      visibleRows={visibleRows}
      emptyMessage="No services"
      {...rest}
    />
  );
}

export default defineComponent('ServiceTable', ServiceTable);
