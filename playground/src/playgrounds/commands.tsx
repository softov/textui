import { useCommand, useRuntime, useState, useStoreValue } from '@textui/core';
import { Button, Column, KeyHints, List, Panel, Row } from '@textui/widgets';

/**
 * Commands and keybindings.
 *
 * Nothing here calls a handler directly. Every button runs a registered
 * command, which is also what the palette finds and what the shortcut fires -
 * three ways in, one implementation, so they cannot drift.
 */
export function CommandsPlayground() {
  const runtime = useRuntime();
  const app = runtime.app();
  const [log, setLog] = useState<string[]>([]);
  const count = useStoreValue<number>('$/demo/counter', 0) ?? 0;

  const record = (message: string): void =>
    setLog((previous) => [message, ...previous].slice(0, 8));

  useCommand({
    id: 'demo.increment',
    title: 'Increment the counter',
    category: 'Demo',
    slots: ['palette', 'hints'],
    run: () => {
      app?.store.update<number>('$/demo/counter', (n) => (n ?? 0) + 1);
      record('demo.increment');
    },
  });

  useCommand({
    id: 'demo.reset',
    title: 'Reset the counter',
    category: 'Demo',
    slots: ['palette'],
    when: '$/demo/counter > 0',
    run: () => {
      app?.store.set('$/demo/counter', 0);
      record('demo.reset');
    },
  });

  const commands = app?.commands.list({ slot: 'palette', enabledOnly: true }) ?? [];

  return (
    <Column flex={1} gap={1} padding={1}>
      <Panel title="Counter">
        <Row gap={2}>
          <text content={String(count)} bold fg="accent" />
          <Button label="Increment" onPress={() => void app?.execute('demo.increment')} autoFocus />
          <Button
            label="Reset"
            tone="danger"
            disabled={!app?.commands.enabled('demo.reset')}
            onPress={() => void app?.execute('demo.reset')}
          />
        </Row>
      </Panel>

      <Row gap={1} flex={1}>
        <Panel title="Enabled commands" flex={1}>
          <List
            items={commands.map((command) => ({
              id: command.id,
              label: command.title,
              description: command.category,
              meta: app?.keybindings.forCommand(command.id)[0],
            }))}
            onActivate={(id) => void app?.execute(id)}
            emptyMessage="Nothing registered"
          />
        </Panel>

        <Panel title="What ran" flex={1}>
          <Column gap={0}>
            {log.length === 0
              ? <text content="nothing yet" fg="subtle" />
              : log.map((entry, i) => <text key={i} content={entry} fg={i === 0 ? 'accent' : 'muted'} />)}
          </Column>
        </Panel>
      </Row>

      <KeyHints
        hints={[
          { keys: 'ctrl+k', label: 'palette' },
          { keys: '+', label: 'increment' },
          { keys: 'q', label: 'quit' },
        ]}
      />
    </Column>
  );
}
