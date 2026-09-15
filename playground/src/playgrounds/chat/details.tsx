import { useState } from '@textui/core';
import { SessionDetails } from '@textui/chat';
import type { DetailField } from '@textui/chat';
import { Button, Column, Panel, Row } from '@textui/widgets';

const FIELDS: DetailField[] = [
  { id: 'status', label: 'Status', value: 'running', tone: 'accent' },
  { id: 'harness', label: 'Harness', value: 'claude  ·  claude-opus-5' },
  { id: 'mode', label: 'Approval', value: 'Ask before edits' },
  { id: 'workspace', label: 'Workspace', value: '/home/me/github/textui.worktrees/chat-package' },
  { id: 'branch', label: 'Branch', value: 'chat-package' },
  { id: 'session', label: 'Session', value: 'ahp-session://default/YWhwLXNlc3Npb246LzlkYmQ2Zjc0LTg0NDgtNDFkZC04Yw' },
  { id: 'chat', label: 'Chat', value: 'ahp-chat://default/YWhwLWNoYXQ6LzlkYmQ2Zjc0' },
  { id: 'model', label: 'Model', value: '', absent: 'not reported yet' },
];

/**
 * Session details: the label column, and long values shown whole.
 */
export function DetailsPlayground() {
  const [values, setValues] = useState<'selected' | 'all'>('selected');

  return (
    <Column flex={1} gap={1} padding={1}>
      <Row gap={2}>
        <Button
          label={values === 'all' ? 'Whole value under the cursor only' : 'Every value whole'}
          onPress={() => setValues(values === 'all' ? 'selected' : 'all')}
        />
      </Row>
      <Panel title="Details" flex={1}>
        <SessionDetails fields={FIELDS} values={values} />
      </Panel>
    </Column>
  );
}
