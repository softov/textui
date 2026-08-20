import {
  Column, KeyHints, Panel, ResourceExplorer, Row, defineComponent, useRuntime, useState,
} from '@textui/core';
import type { Resource } from '@textui/core';

/**
 * A resource explorer.
 *
 * The screen knows nothing about file types. It browses a URI and hands what
 * it finds to the registry, which decides what opens it - so adding a viewer
 * for a new kind makes it work here without touching this file.
 */
export interface ExplorerScreenProps {
  root?: string;
  title?: string;
}

export function ExplorerScreen({ root = 'file:///', title = 'Explorer' }: ExplorerScreenProps) {
  const runtime = useRuntime();
  const app = runtime.app();
  const [current, setCurrent] = useState<Resource | null>(null);

  return (
    <Column flex={1} gap={1} padding={1}>
      <Row gap={1}>
        <text content={title} bold />
        <text content={current?.uri ?? root} fg="muted" truncate="start" flex={1} />
        {current ? <text content={current.kind} fg="subtle" /> : null}
      </Row>

      <Panel flex={1}>
        <ResourceExplorer
          root={root}
          preview
          visibleRows={16}
          onOpen={(resource) => {
            setCurrent(resource);
            void app?.openResource(resource.uri);
          }}
        />
      </Panel>

      <KeyHints
        hints={[
          { keys: 'up/down', label: 'move' },
          { keys: 'right', label: 'expand' },
          { keys: 'enter', label: 'open' },
          { keys: 'q', label: 'quit' },
        ]}
      />
    </Column>
  );
}

export default defineComponent('ExplorerScreen', ExplorerScreen);
