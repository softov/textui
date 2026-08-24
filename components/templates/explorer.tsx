import type { Resource } from '@textui/core';
import { defineComponent, useRuntime, useState } from '@textui/core';
import { Column, KeyHints, Panel, Row } from '@textui/widgets';
import { ResourceExplorer, ResourceView } from '@textui/documents';

/**
 * A resource explorer.
 *
 * The screen knows nothing about file types. It browses a URI and hands what
 * it finds to the registry, which decides what opens it - so adding a viewer
 * for a new kind makes it work here without touching this file.
 *
 * The tree and the viewer are two components, composed here. That is the only
 * place that knows there is exactly one viewer; a screen wanting two panes
 * puts two `ResourceView`s side by side and feeds them different URIs.
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

      <Row flex={1} gap={1}>
        <Panel width={30}>
          <ResourceExplorer
            root={root}
            visibleRows={16}
            onSelect={setCurrent}
            onOpen={(resource) => {
              setCurrent(resource);
              void app?.openResource(resource.uri);
            }}
          />
        </Panel>
        <Panel flex={1}>
          <ResourceView uri={current?.uri ?? null} />
        </Panel>
      </Row>

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
