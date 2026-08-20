import {
  Button, Column, KeyValue, Panel, Row, TextInput,
  useCollection, useStore, useStoreValue, useState,
} from '@textui/core';

/**
 * The store.
 *
 * Two components read the same path and neither knows about the other; a
 * computed path derives from it; a collection appends without anyone holding
 * an array. That is the whole point of a single store, shown in one screen.
 *
 * Note which hook does what. `useStore` is state: its second argument is an
 * initial value and it is written, so the two mirrors below - which read with
 * `useStoreValue` and pass no fallback at all - show `billing-worker` from the
 * first frame. `useStoreValue` never writes.
 */
export function StorePlayground() {
  const [name, setName] = useStore<string>('$/demo/agent/name', 'billing-worker');
  const [draft, setDraft] = useState('');
  const alerts = useCollection<{ id: number; text: string }>('$/demo/alerts/list');
  const total = useStoreValue<number>('$/summary/demo/alerts', 0);

  return (
    <Column flex={1} gap={1} padding={1}>
      <Panel title="One path, two readers">
        <Column gap={0}>
          <TextInput label="$/demo/agent/name" value={name ?? ''} onChange={setName} />
          <Row gap={1}>
            <text content="Reader A:" fg="muted" />
            <MirrorA />
          </Row>
          <Row gap={1}>
            <text content="Reader B:" fg="muted" />
            <MirrorB />
          </Row>
        </Column>
      </Panel>

      <Panel title="A collection">
        <Column gap={0}>
          <Row gap={1}>
            <TextInput
              value={draft}
              onChange={setDraft}
              placeholder="Add an alert"
              flex={1}
              onSubmit={() => {
                if (draft.trim() === '') return;
                alerts.append({ id: Date.now(), text: draft });
                setDraft('');
              }}
            />
            <Button
              label="Add"
              tone="primary"
              onPress={() => {
                if (draft.trim() === '') return;
                alerts.append({ id: Date.now(), text: draft });
                setDraft('');
              }}
            />
            <Button label="Clear" onPress={() => alerts.clear()} />
          </Row>

          {alerts.all().map((alert) => (
            <Row key={alert.id} gap={1}>
              <text content="-" fg="accent" />
              <text content={alert.text} flex={1} />
              <Button
                label="x"
                variant="ghost"
                tone="danger"
                onPress={() => alerts.remove((a) => a.id === alert.id)}
              />
            </Row>
          ))}
        </Column>
      </Panel>

      <Panel title="Derived">
        <KeyValue
          items={[
            { label: '$/demo/alerts/list', value: `${alerts.length} items` },
            { label: '$/summary/demo/alerts', value: String(total ?? 0) },
          ]}
        />
      </Panel>
    </Column>
  );
}

// No fallback in either mirror, on purpose: what they show is what the store
// holds, so a blank here would mean the field above never wrote it.
function MirrorA() {
  const value = useStoreValue<string>('$/demo/agent/name');
  return <text content={value ?? ''} bold />;
}

function MirrorB() {
  const value = useStoreValue<string>('$/demo/agent/name');
  return <text content={(value ?? '').toUpperCase()} fg="accent" />;
}
