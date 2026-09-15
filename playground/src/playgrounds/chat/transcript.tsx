import { useState } from '@textui/core';
import { ChatTranscript } from '@textui/chat';
import { Column, Panel } from '@textui/widgets';
import { BLOCKS } from './fixtures.js';

/**
 * The transcript: every block kind in one feed.
 *
 * The cursor and the folds are held here, as a screen would hold them, so
 * arrows walk the selectable blocks and enter opens whichever one is under
 * the cursor.
 */
export function ChatTranscriptPlayground() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ c3: true });
  const [cursor, setCursor] = useState(4);

  return (
    <Column flex={1} padding={1}>
      <Panel title="Transcript" meta="arrows move · enter opens" flex={1}>
        <ChatTranscript
          blocks={BLOCKS}
          expanded={expanded}
          onToggle={(id) => setExpanded({ ...expanded, [id]: !expanded[id] })}
          cursor={cursor}
          onCursor={setCursor}
          head={<text content="Lift the chat components into @textui/chat" bold fg="accent" />}
          autoFocus
          flex={1}
        />
      </Panel>
    </Column>
  );
}
