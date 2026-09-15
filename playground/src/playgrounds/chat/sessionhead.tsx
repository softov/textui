import { ChatSessionHead } from '@textui/chat';
import { Column, Panel } from '@textui/widgets';
import { SESSIONS } from './fixtures.js';

/**
 * The head over a conversation: one with everything, one with the least.
 */
export function SessionHeadPlayground() {
  const [full, , , bare] = SESSIONS;
  if (!full || !bare) return null;

  return (
    <Column flex={1} gap={1} padding={1}>
      <Panel title="Everything known">
        <ChatSessionHead
          session={full}
          model="claude-opus-5"
          chat="ahp-chat://one"
          settings={[{ label: 'Approval', value: 'Ask before edits' }, { label: 'Thinking', value: 'high' }]}
          present={[{ clientId: 'me' }, { clientId: 'x', displayName: 'Ada' }]}
        />
      </Panel>
      <Panel title="The least">
        <ChatSessionHead session={bare} />
      </Panel>
    </Column>
  );
}
