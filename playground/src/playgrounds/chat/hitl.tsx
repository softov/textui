import { useState } from '@textui/core';
import { ChatHitl, ChatInputStatus } from '@textui/chat';
import type { ChatAnswer, ChatSendStatus } from '@textui/chat';
import { Button, Column, KeyValue, Row } from '@textui/widgets';
import { ASK, CONFIRM } from './fixtures.js';

/**
 * Waiting on you: the confirmation, then every question kind.
 *
 * The draft is held here and handed back in, so what the block shows is
 * exactly what was written through `onDraft` - and the status row under it
 * says what became of an answer, as the application would after sending it.
 */
export function HitlPlayground() {
  const [which, setWhich] = useState<'confirm' | 'ask'>('confirm');
  const [draft, setDraft] = useState<Record<string, ChatAnswer>>({});
  const [status, setStatus] = useState<ChatSendStatus | null>(null);
  const [heard, setHeard] = useState('(nothing yet)');

  return (
    <Column flex={1} gap={1} padding={1}>
      <Row gap={2}>
        <Button label="A confirmation" onPress={() => setWhich('confirm')} />
        <Button label="A question" onPress={() => setWhich('ask')} />
        <Button label="Clear status" onPress={() => setStatus(null)} />
      </Row>
      <ChatHitl
        input={which === 'confirm' ? CONFIRM : ASK}
        draft={draft}
        onDraft={setDraft}
        onApprove={(id) => { setHeard(`approved${id ? ` (${id})` : ''}`); setStatus({ state: 'sending', text: 'Sending your answer' }); }}
        onDeny={() => { setHeard('denied'); setStatus({ state: 'failed', text: 'The host did not take the answer' }); }}
        onAnswer={(answers, accepted) => {
          setHeard(`${accepted ? 'answered' : 'declined'}: ${JSON.stringify(answers)}`);
          setStatus({ state: 'sending', text: 'Sending your answers' });
        }}
        onEscape={() => setHeard('escaped')}
      />
      <ChatInputStatus status={status} />
      <KeyValue items={[{ label: 'Heard', value: heard }]} />
    </Column>
  );
}
