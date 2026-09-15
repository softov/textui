import { useState } from '@textui/core';
import { ConnectionBadge, SessionList } from '@textui/chat';
import { Column, KeyValue, Panel, Row } from '@textui/widgets';
import { SESSIONS } from './fixtures.js';

/**
 * The catalogue, and the badge that says which host it came from.
 */
export function SessionsPlayground() {
  const [selected, setSelected] = useState<string | null>(SESSIONS[1]?.id ?? null);
  const [opened, setOpened] = useState('(nothing yet)');

  return (
    <Column flex={1} gap={1} padding={1}>
      <Row gap={2}>
        <ConnectionBadge url="ws://localhost:4020" state="connected" sessions={SESSIONS.length} />
        <ConnectionBadge url="ws://build.local:4020" state="connecting" />
        <ConnectionBadge url="ws://old.local:4020" state="offline" />
      </Row>
      <Panel title="Sessions" flex={1}>
        <SessionList
          sessions={SESSIONS}
          selectedId={selected}
          onSelect={setSelected}
          onOpen={setOpened}
          autoFocus
          flex={1}
        />
      </Panel>
      <KeyValue items={[{ label: 'Selected', value: selected ?? '' }, { label: 'Opened', value: opened }]} />
    </Column>
  );
}
