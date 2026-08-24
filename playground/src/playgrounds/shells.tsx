import { useRuntime, useState } from '@textui/core';
import { Column, KeyValue, List, Panel, Row } from '@textui/widgets';

/**
 * Shells and themes.
 *
 * Switch either one and watch this screen stay exactly where it is. That is
 * the whole claim the architecture makes: the shell decides where surfaces go,
 * the theme decides what they look like, and neither is a component's business.
 */
export function ShellsPlayground() {
  const runtime = useRuntime();
  const app = runtime.app();
  const [, force] = useState(0);

  const shells = app?.shells.list() ?? [];
  const themes = app?.themes.list() ?? [];

  return (
    <Column flex={1} gap={1} padding={1}>
      <Row gap={1} flex={1}>
        <Panel title="Shells" flex={1}>
          <List
            items={shells.map((shell) => ({
              id: shell.id,
              label: shell.title,
              description: shell.description,
              meta: shell.id === app?.activeShell() ? 'active' : undefined,
            }))}
            onActivate={(id) => {
              app?.setShell(id);
              force((n) => n + 1);
            }}
          />
        </Panel>

        <Panel title="Themes" flex={1}>
          <List
            items={themes.map((theme) => ({
              id: theme.id,
              label: theme.name,
              description: theme.appearance,
              meta: theme.id === app?.theme.id ? 'active' : undefined,
            }))}
            onActivate={(id) => {
              app?.setTheme(id);
              force((n) => n + 1);
            }}
          />
        </Panel>
      </Row>

      <Panel title="Now">
        <KeyValue
          columns={2}
          items={[
            { label: 'shell', value: app?.activeShell() ?? '-' },
            { label: 'theme', value: app?.theme.id ?? '-' },
            { label: 'appearance', value: app?.theme.appearance ?? '-' },
            { label: 'border', value: app?.theme.border ?? '-' },
            { label: 'density', value: app?.theme.density ?? '-' },
          ]}
        />
      </Panel>
    </Column>
  );
}
