import { defineComponent, useRuntime, useState, useStoreValue } from '@textui/core';
import { Breadcrumb, Column, List, Panel, Row, StatusBar, Tabs } from '@textui/widgets';
import { ServiceTable, type Service } from '../ui/service-table.js';

/**
 * A command centre.
 *
 * Everything actionable here is a registered command, which is why the palette
 * finds it and the status bar can show its shortcut without either of them
 * being told about it. Register a command and it appears in all three places.
 */
export function CommandCenter() {
  const runtime = useRuntime();
  const app = runtime.app();
  const services = useStoreValue<Service[]>('$/services/list', []) ?? [];
  const [tab, setTab] = useState('services');
  const [selected, setSelected] = useState<string | undefined>(undefined);

  const current = services.find((s) => s.id === selected);
  const alerts = services.filter((s) => s.status !== 'up');

  return (
    <Column flex={1}>
      <Row gap={1} padding={{ left: 1, right: 1 }}>
        <Breadcrumb
          items={[
            { id: 'root', label: 'production' },
            { id: 'services', label: 'services' },
            ...(current ? [{ id: current.id, label: current.name }] : []),
          ]}
          maxItems={4}
        />
      </Row>

      <Tabs
        items={[
          { id: 'services', label: 'Services', badge: services.length },
          { id: 'alerts', label: 'Alerts', badge: alerts.length },
        ]}
        activeId={tab}
        onChange={setTab}
        padding={{ left: 1 }}
      />

      <Row flex={1} gap={1} padding={1}>
        <Panel title={tab === 'services' ? 'All services' : 'Needs attention'} flex={1}>
          <ServiceTable
            services={tab === 'services' ? services : alerts}
            selectedId={selected}
            onSelect={setSelected}
            onActivate={(id) => void app?.execute('service.open', { id })}
            visibleRows={12}
          />
        </Panel>

        <Panel title="Actions" width={28}>
          <List
            items={(app?.commands.list({ slot: 'palette', enabledOnly: true }) ?? []).map((command) => ({
              id: command.id,
              label: command.title,
              meta: app?.keybindings.forCommand(command.id)[0],
            }))}
            onActivate={(id) => void app?.execute(id)}
            emptyMessage="No commands"
          />
        </Panel>
      </Row>

      <StatusBar
        leading={[
          { id: 'env', label: 'production', icon: '*' },
          { id: 'count', label: `${services.length} services` },
        ]}
        trailing={[
          { id: 'alerts', label: `${alerts.length} alerts`, tone: alerts.length ? 'warning' : 'muted' },
          { id: 'palette', label: 'ctrl+k commands' },
        ]}
        padding={{ left: 1, right: 1 }}
      />
    </Column>
  );
}

export default defineComponent('CommandCenter', CommandCenter);
