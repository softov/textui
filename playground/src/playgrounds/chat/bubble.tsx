import { useState } from '@textui/core';
import { ChatBubble, ReasoningBlock, StreamingText } from '@textui/chat';
import { Button, Column, Panel, Row } from '@textui/widgets';

/**
 * Bubbles.
 *
 * One of each speaker, the two ways text is still being said, and the
 * markdown switch - which is a prop now, so the button here is the whole of
 * what an application has to do to offer it.
 */
export function ChatBubblePlayground() {
  const [markdown, setMarkdown] = useState(true);
  const [expanded, setExpanded] = useState(false);

  return (
    <Column flex={1} gap={1} padding={1}>
      <Row gap={2}>
        <Button label={markdown ? 'Show raw' : 'Show markdown'} autoFocus onPress={() => setMarkdown(!markdown)} />
        <Button label={expanded ? 'Fold reasoning' : 'Open reasoning'} onPress={() => setExpanded(!expanded)} />
      </Row>
      <Panel title="Speakers" flex={1}>
        <Column gap={1}>
          <ChatBubble speaker="user" meta="09:41">
            <text content="Can you rename the package and keep the tests green?" wrap="word" />
          </ChatBubble>
          <ChatBubble speaker="agent" author="claude-opus-5" meta="12.4s">
            <ReasoningBlock
              content="Renaming touches the manifest, the tsconfig references and every import. The tests only see the imports."
              expanded={expanded}
              summary="thought for 3s"
            />
            <StreamingText
              content={'Yes. Three steps:\n\n1. the **manifest**\n2. the `tsconfig` references\n3. every import'}
              markdown={markdown}
            />
          </ChatBubble>
          <ChatBubble speaker="agent" author="claude-opus-5" active>
            <StreamingText content="Running the suite now" streaming markdown={markdown} />
          </ChatBubble>
          <ChatBubble speaker="system" tone="warning">
            <text content="The host reconnected after 2s." />
          </ChatBubble>
        </Column>
      </Panel>
    </Column>
  );
}
