import {
  Breadcrumb, Column, KeyHints, KeyValue, Menu, Panel, Row, Tree,
  useEffect, useRuntime, useState, useTheme,
} from '@textui/core';
import { ResourceView, useDocument } from '@textui/documents';
import type { Resource, TreeNode } from '@textui/core';
import { extensionOf } from './filesystem.js';

/**
 * The filesystem explorer.
 *
 * Read the imports: there is no `MarkdownViewer` here, no `JsonViewer`, and no
 * `if (ext === '.json')`. The tree browses URIs, `ResourceView` asks the
 * registry what opens the selected kind, the "opens with" pane lists whatever
 * else was registered for it, and the actions pane lists what can be done to
 * it. Registering an adapter makes this screen understand a new file type
 * without an edit.
 *
 * The layout is deliberately rigid. Every pane is either a fixed size or a
 * flex share, so opening a four-line file and a four-thousand-line one produce
 * the same frame - the viewer scrolls inside its pane instead of resizing it.
 */
export interface ExplorerProps {
  root?: string;
}

/** Rows the bottom strip gets. Fixed, so the viewer above it never moves. */
const DETAIL_ROWS = 8;
const TREE_WIDTH = 32;

export function Explorer({ root = process.cwd() }: ExplorerProps) {
  const runtime = useRuntime();
  const theme = useTheme();
  const app = runtime.app();

  const rootUri = root.startsWith('file:') ? root : `file://${root}`;
  const [children, setChildren] = useState<Record<string, Resource[]>>({});
  const [expanded, setExpanded] = useState<string[]>([rootUri]);
  const [selected, setSelected] = useState<Resource | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  const doc = useDocument(selected && !selected.capabilities.includes('list') ? selected.uri : null);

  const load = (uri: string): void => {
    if (!app || children[uri]) return;
    void app.resources
      .list(uri)
      .then((items) => setChildren((previous) => ({ ...previous, [uri]: items })))
      .catch(setError);
  };

  useEffect(() => {
    load(rootUri);
  }, [rootUri]);

  // Select the first entry so the viewer has something to show at once.
  const top = children[rootUri];
  useEffect(() => {
    if (selected || !top?.length) return;
    const first = top.find((r) => !r.capabilities.includes('list')) ?? top[0];
    if (first) void app?.resources.stat(first.uri).then(setSelected);
  }, [top?.length]);

  // Commands and palette actions need to know what is selected without being
  // handed it, so the selection is published rather than passed.
  useEffect(() => {
    if (!app) return;
    app.store.set('$/active/resource', selected
      ? { uri: selected.uri, kind: selected.kind, name: selected.metadata.name }
      : null);
  }, [selected?.uri, selected?.kind]);

  const choose = (resource: Resource | null): void => {
    setSelected(resource);
    // A viewer chosen for a JSON file means nothing for the next markdown one.
    setViewerId(null);
  };

  const toNode = (resource: Resource): TreeNode => {
    const container = resource.capabilities.includes('list');
    return {
      id: resource.uri,
      label: resource.metadata.name,
      hasChildren: container,
      children: children[resource.uri]?.map(toNode),
      meta: container ? undefined : formatSize(resource.metadata.size),
      tone: container ? 'accent' : undefined,
    };
  };

  const nodes = (children[rootUri] ?? []).map(toNode);
  const actions = selected ? app?.resources.actionsFor(selected.kind, 'context') ?? [] : [];
  const viewers = selected ? app?.resources.viewersFor(selected.kind) ?? [] : [];
  const activeViewer = viewerId ?? viewers[0]?.id;

  if (error) {
    return (
      <Panel title="Could not read that directory">
        <text content={error instanceof Error ? error.message : String(error)} fg="danger" wrap="word" />
      </Panel>
    );
  }

  const lines = doc.content === '' ? 0 : doc.content.split('\n').length;

  return (
    <Column flex={1} gap={1} padding={1}>
      <Row gap={1} height={1}>
        <text content="Explorer" bold />
        <Breadcrumb items={crumbs(rootUri, selected?.uri)} maxItems={5} flex={1} />
        {doc.dirty ? <text content="modified" fg="warning" /> : null}
      </Row>

      {/* `align="stretch"` matters: a Row centres its children by default, and
          a centred pane is one the layout no longer stretches - so its height
          would come from its content, which is exactly what must not happen
          here. */}
      <Row flex={1} gap={1} align="stretch">
        <Panel title="Files" width={TREE_WIDTH} shrink={0}>
          <Tree
            flex={1}
            nodes={nodes}
            selectedId={selected?.uri}
            expandedIds={expanded}
            onToggle={(id, isExpanded) => {
              setExpanded(isExpanded ? [...expanded, id] : expanded.filter((e) => e !== id));
              if (isExpanded) load(id);
            }}
            onSelect={(id) => void app?.resources.stat(id).then(choose)}
            onActivate={(id) => void app?.openResource(id)}
          />
        </Panel>

        <Column flex={1} gap={1}>
          <Panel
            title={selected?.metadata.name ?? 'Nothing selected'}
            footer={selected ? statusOf(selected, lines, doc.dirty) : undefined}
            flex={1}
          >
            <ResourceView uri={selected?.uri ?? null} viewerId={activeViewer} flex={1} />
          </Panel>

          <Row gap={1} height={DETAIL_ROWS} align="stretch">
            <Panel title="Opens with" width={20} shrink={0}>
              {viewers.length === 0
                ? <text content="nothing registered" fg="subtle" />
                : (
                  <Menu
                    flex={1}
                    activeId={activeViewer}
                    items={viewers.map((viewer) => ({
                      id: viewer.id,
                      label: viewer.title,
                      icon: viewer.id === activeViewer ? theme.glyphs.check : ' ',
                    }))}
                    onSelect={(id) => setViewerId(id)}
                  />
                )}
            </Panel>

            <Panel title="Actions" width={22} shrink={0}>
              {actions.length === 0
                ? <text content="none for this kind" fg="subtle" />
                : (
                  <Menu
                    flex={1}
                    items={actions.map((action) => ({ id: action.id, label: action.title }))}
                    onSelect={(id) => {
                      const action = actions.find((a) => a.id === id);
                      if (!action || !app || !selected) return;
                      void action.run(
                        { uri: selected.uri },
                        { app, store: app.store, scopeId: null, source: 'menu' },
                      );
                    }}
                  />
                )}
            </Panel>

            <Panel title="Resource" flex={1}>
              <KeyValue
                items={
                  selected
                    ? [
                        { label: 'kind', value: selected.kind },
                        { label: 'ext', value: extensionOf(selected.uri) },
                        { label: 'size', value: formatSize(selected.metadata.size) ?? '-' },
                        { label: 'can', value: selected.capabilities.join(', ') },
                      ]
                    : [{ label: 'kind', value: '-' }]
                }
              />
            </Panel>
          </Row>
        </Column>
      </Row>

      <KeyHints
        height={1}
        hints={[
          { keys: `${theme.glyphs.arrowUp}${theme.glyphs.arrowDown}`, label: 'move' },
          { keys: `${theme.glyphs.chevronRight}${theme.glyphs.chevronLeft}`, label: 'expand' },
          { keys: 'pgup/pgdn', label: 'scroll' },
          { keys: 'tab', label: 'panes' },
          { keys: 'enter', label: 'open' },
          { keys: 'q', label: 'quit' },
        ]}
      />
    </Column>
  );
}

/** What the viewer's footer says. Never the file's content, so it cannot move. */
function statusOf(resource: Resource, lines: number, dirty: boolean): string {
  const parts = [resource.kind];
  if (lines > 0) parts.push(`${lines} lines`);
  const size = formatSize(resource.metadata.size);
  if (size) parts.push(size);
  if (dirty) parts.push('modified');
  return parts.join(' · ');
}

function crumbs(root: string, uri?: string): { id: string; label: string }[] {
  if (!uri) return [{ id: root, label: root.replace(/^file:\/\//, '') }];
  const relative = uri.startsWith(root) ? uri.slice(root.length) : uri;
  const parts = relative.split('/').filter((p) => p !== '');

  let accumulated = root;
  return [
    { id: root, label: '/' },
    ...parts.map((part) => {
      accumulated = `${accumulated}/${part}`;
      return { id: accumulated, label: decodeURIComponent(part) };
    }),
  ];
}

function formatSize(bytes: number | undefined): string | undefined {
  if (bytes === undefined) return undefined;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
