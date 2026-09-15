import { useState } from '@textui/core';
import { ToolCallRow } from '@textui/chat';
import { Column, Panel } from '@textui/widgets';
import { CALLS } from './fixtures.js';

/**
 * Tool call rows: one per status, each opening on its own.
 */
export function ToolCallPlayground() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ c3: true });

  return (
    <Column flex={1} padding={1}>
      <Panel title="Tool calls" meta="click a row to open it" flex={1}>
        <Column gap={0}>
          {CALLS.map((call, i) => (
            <ToolCallRow
              key={call.id}
              call={call}
              expanded={expanded[call.id] ?? false}
              active={i === 1}
              onToggle={() => setExpanded({ ...expanded, [call.id]: !expanded[call.id] })}
            />
          ))}
        </Column>
      </Panel>
    </Column>
  );
}
