import type { ComponentDefinition } from '../types/component-registry.js';
import type { BoxProps } from '../jsx/intrinsics.js';
import type { Resource, ResourceViewerDefinition } from '../types/resource.js';
import { h, defineComponent } from '../jsx/factory.js';
import {
  useDocument, useFocus, useInput, useMeasure, useRuntime, useState, useTheme,
  useTask, useEffect,
} from '../runtime/hooks.js';
import { Tree, CodeViewer, type TreeNode } from './data.js';
import { EmptyState, ErrorState, KeyValue, Spinner } from './display.js';
import { Breadcrumb, Menu } from './navigation.js';
import { viewportRows } from './viewport.js';

/**
 * Resource components.
 *
 * The explorer never names a viewer. It asks the registry which component
 * opens this kind and mounts whatever comes back, which is what lets a new
 * resource type arrive with its own viewer and work everywhere at once.
 */

export interface TextViewerProps extends BoxProps {
  resource?: Resource;
  uri?: string;
  content?: string;
}

export const TextViewer = defineComponent<TextViewerProps>('TextViewer', (props) => {
  const { resource, uri, content, ...rest } = props;
  const target = content === undefined ? (uri ?? resource?.uri ?? null) : null;
  // A buffer rather than a read, so an action that rewrites the text shows its
  // work here instead of requiring a save first.
  const doc = useDocument(target);

  if (content === undefined && doc.status === 'running') {
    return h(Spinner, { label: 'Loading…', ...rest });
  }
  if (content === undefined && doc.status === 'error') {
    return h(ErrorState, { error: doc.error, ...rest });
  }

  return h(CodeViewer, {
    content: content ?? doc.content,
    lineNumbers: true,
    // The viewer never names a language: it passes what it knows and the
    // highlighter registry decides, or decides nothing and it stays plain.
    kind: resource?.kind ?? doc.kind,
    uri: uri ?? resource?.uri,
    flex: 1,
    ...rest,
  });
});

export type MarkdownViewerProps = TextViewerProps;

/**
 * A deliberately small Markdown renderer: headings, emphasis, lists, rules,
 * code fences, block quotes. Not a parser - a formatter for the subset that
 * appears in READMEs and notes, which is what a terminal viewer is for.
 */
export const MarkdownViewer = defineComponent<MarkdownViewerProps>('MarkdownViewer', (props) => {
  const theme = useTheme();
  const { resource, uri, content, ...rest } = props;
  const doc = useDocument(content === undefined ? (uri ?? resource?.uri ?? null) : null);
  const measured = useMeasure();
  const focus = useFocus({});
  const [top, setTop] = useState(0);

  if (content === undefined && doc.status === 'running') {
    return h(Spinner, { label: 'Loading…', ...rest });
  }
  if (content === undefined && doc.status === 'error') {
    return h(ErrorState, { error: doc.error, ...rest });
  }

  const text = content ?? doc.content;
  const lines = text.split('\n');

  // Render a window, not the file. A README is short; a changelog is not, and
  // one instance per line is the difference between a pane that opens and one
  // that stalls the frame.
  const rows = viewportRows({ flex: 1 }, measured, lines.length);
  const maxTop = Math.max(0, lines.length - rows);
  const first = Math.min(top, maxTop);
  const window = lines.slice(first, first + rows);

  useInput(
    (event) => {
      switch (event.name) {
        case 'up': setTop(Math.max(0, first - 1)); return true;
        case 'down': setTop(Math.min(maxTop, first + 1)); return true;
        case 'pageup': setTop(Math.max(0, first - rows)); return true;
        case 'pagedown': setTop(Math.min(maxTop, first + rows)); return true;
        case 'home': setTop(0); return true;
        case 'end': setTop(maxTop); return true;
        default: return false;
      }
    },
    { focusId: focus.id },
  );

  const out: unknown[] = [];
  // A fence that opened above the window is still open inside it. Counting is
  // cheap; getting it wrong turns a code block into prose.
  let inFence = countFences(lines, first) % 2 === 1;
  let fence: string[] = [];

  const flushFence = (key: number): void => {
    out.push(h('box', {
      key: `fence-${key}`,
      border: { style: theme.border, color: 'borderSubtle' },
      padding: [0, 1],
    }, h(CodeViewer, { content: fence.join('\n'), lineNumbers: false, scrollbar: false, showCaret: false })));
    fence = [];
  };

  window.forEach((line, offset) => {
    const i = first + offset;
    if (line.trimStart().startsWith('```')) {
      if (inFence) flushFence(i);
      inFence = !inFence;
      return;
    }
    if (inFence) {
      fence.push(line);
      return;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = (heading[1] as string).length;
      out.push(h('text', {
        key: i,
        content: heading[2] as string,
        bold: level <= 2,
        underline: level === 1,
        fg: level <= 2 ? 'text' : 'muted',
      }));
      return;
    }

    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      out.push(h('box', { key: i, height: 1, fill: theme.borderChars().top, fg: 'borderSubtle' }));
      return;
    }

    const bullet = /^(\s*)[-*+]\s+(.*)$/.exec(line);
    if (bullet) {
      out.push(h('box', { key: i, direction: 'row', gap: 1 },
        h('text', { content: `${bullet[1]}${theme.glyphs.bulletFilled}`, fg: 'accent' }),
        h('text', { content: stripInline(bullet[2] as string), wrap: 'word', flex: 1 })));
      return;
    }

    const ordered = /^(\s*)(\d+)\.\s+(.*)$/.exec(line);
    if (ordered) {
      out.push(h('box', { key: i, direction: 'row', gap: 1 },
        h('text', { content: `${ordered[1]}${ordered[2]}.`, fg: 'accent' }),
        h('text', { content: stripInline(ordered[3] as string), wrap: 'word', flex: 1 })));
      return;
    }

    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      out.push(h('box', { key: i, direction: 'row', gap: 1 },
        h('text', { content: theme.borderChars().left, fg: 'borderSubtle' }),
        h('text', { content: stripInline(quote[1] as string), fg: 'muted', wrap: 'word', flex: 1 })));
      return;
    }

    out.push(h('text', { key: i, content: stripInline(line), wrap: 'word' }));
  });

  if (inFence && fence.length > 0) flushFence(lines.length);

  return h('box', {
    id: focus.id,
    role: 'document',
    direction: 'column',
    flex: 1,
    overflow: 'scroll',
    ...rest,
  }, ...out);
});

/** How many fence markers appear before `limit`. Odd means one is open. */
function countFences(lines: string[], limit: number): number {
  let count = 0;
  for (let i = 0; i < limit && i < lines.length; i++) {
    if ((lines[i] as string).trimStart().startsWith('```')) count++;
  }
  return count;
}

/** Emphasis markers are noise once nothing can render them. */
function stripInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(^|[^*])\*([^*]+?)\*/g, '$1$2')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\((.+?)\)/g, '$1');
}

export interface FallbackViewerProps extends BoxProps {
  resource?: Resource;
  uri?: string;
}

/** What an unknown kind gets: its metadata, honestly labelled. */
export const FallbackViewer = defineComponent<FallbackViewerProps>('FallbackViewer', (props) => {
  const { resource, uri: _uri, ...rest } = props;
  if (!resource) return h(EmptyState, { title: 'Nothing selected', ...rest });

  return h('box', { direction: 'column', gap: 1, padding: 1, ...rest },
    h(EmptyState, {
      title: 'No viewer for this kind',
      message: `Nothing is registered to display "${resource.kind}".`,
      hint: 'Register a viewer with resources.registerViewer().',
    }),
    h(KeyValue, {
      items: [
        { label: 'uri', value: resource.uri },
        { label: 'kind', value: resource.kind },
        { label: 'size', value: resource.metadata.size !== undefined ? `${resource.metadata.size} bytes` : '—' },
        { label: 'can', value: resource.capabilities.join(', ') || '—' },
      ],
    }),
  );
});

export interface ResourceViewProps extends BoxProps {
  uri: string | null;
  /** Force a specific registered viewer. */
  viewerId?: string;
  mode?: 'view' | 'edit';
}

/**
 * Show a resource using whichever viewer the registry picks. This is the
 * component an explorer mounts, and the reason the explorer needs no knowledge
 * of file types.
 */
export const ResourceView = defineComponent<ResourceViewProps>('ResourceView', (props) => {
  const runtime = useRuntime();
  const { uri, viewerId, mode, ...rest } = props;
  const app = runtime.app();

  const task = useTask(async () => {
    if (!uri || !app) return null;
    return app.resources.stat(uri);
  }, [uri]);

  useEffect(() => {
    void task.run();
  }, [uri]);

  if (!uri) return h(EmptyState, { title: 'Nothing selected', ...rest });
  if (task.status === 'running') return h(Spinner, { label: 'Loading…', ...rest });
  if (task.status === 'error') return h(ErrorState, { error: task.error, ...rest });

  const resource = task.data;
  if (!resource) return h(EmptyState, { title: 'Not found', message: uri, ...rest });
  if (!app) return null;

  const node = app.resources.nodeFor(resource, { viewerId, mode });
  if (!node) return h(FallbackViewer, { resource, ...rest });

  return h('box', { direction: 'column', flex: 1, ...rest }, node);
});

export interface ResourceExplorerProps extends BoxProps {
  /** Root URI to browse. */
  root: string;
  /** Called when a resource is opened. */
  onOpen?(resource: Resource): void;
  selectedUri?: string;
  /** Show the viewer beside the tree rather than only emitting onOpen. */
  preview?: boolean;
  visibleRows?: number;
}

/**
 * Browse resources and open them.
 *
 * Children load lazily on expand, because a provider may be a network and a
 * tree that eagerly walks one is a tree that hangs.
 */
export const ResourceExplorer = defineComponent<ResourceExplorerProps>('ResourceExplorer', (props) => {
  const runtime = useRuntime();
  const theme = useTheme();
  const { root, onOpen, selectedUri, preview = true, visibleRows, ...rest } = props;
  const app = runtime.app();

  const [children, setChildren] = useState<Record<string, Resource[]>>({});
  const [expanded, setExpanded] = useState<string[]>([root]);
  const [selected, setSelected] = useState<string | null>(selectedUri ?? null);
  const [error, setError] = useState<unknown>(null);

  const load = (uri: string): void => {
    if (!app || children[uri]) return;
    void app.resources
      .list(uri)
      .then((items) => setChildren((prev) => ({ ...prev, [uri]: items })))
      .catch((err: unknown) => setError(err));
  };

  useEffect(() => {
    load(root);
  }, [root]);

  // Select the first entry once the root has listed, so a preview pane has
  // something to show rather than an empty state nobody asked for.
  const rootChildren = children[root];
  useEffect(() => {
    if (selectedUri !== undefined || selected !== null) return;
    const first = rootChildren?.[0];
    if (first) setSelected(first.uri);
  }, [rootChildren?.length, selectedUri]);

  const toNode = (resource: Resource): TreeNode => {
    const kids = children[resource.uri];
    const container = resource.capabilities.includes('list');
    return {
      id: resource.uri,
      label: resource.metadata.name,
      icon: container
        ? (expanded.includes(resource.uri) ? theme.glyphs.chevronDown : theme.glyphs.chevronRight)
        : undefined,
      hasChildren: container,
      children: kids?.map(toNode),
      meta: resource.metadata.size !== undefined ? formatSize(resource.metadata.size) : undefined,
    };
  };

  const roots = (children[root] ?? []).map(toNode);
  const current = selectedUri ?? selected;

  if (error) return h(ErrorState, { error, title: 'Could not list resources', ...rest });

  const tree = h(Tree, {
    nodes: roots,
    selectedId: current ?? undefined,
    expandedIds: expanded,
    visibleRows,
    onToggle: (id: string, isExpanded: boolean) => {
      setExpanded(isExpanded ? [...expanded, id] : expanded.filter((e) => e !== id));
      if (isExpanded) load(id);
    },
    onSelect: (id: string) => setSelected(id),
    onActivate: (id: string) => {
      setSelected(id);
      const found = findResource(children, id);
      if (found) onOpen?.(found);
    },
    flex: preview ? undefined : 1,
    width: preview ? 30 : undefined,
  });

  if (!preview) return h('box', { direction: 'column', flex: 1, ...rest }, tree);

  return h('box', { direction: 'row', flex: 1, gap: 1, ...rest },
    tree,
    h('box', { flex: 1, border: { style: theme.border, sides: { left: true } }, padding: { left: 1 } },
      h(ResourceView, { uri: current })),
  );
});

function findResource(children: Record<string, Resource[]>, uri: string): Resource | null {
  for (const list of Object.values(children)) {
    const found = list.find((r) => r.uri === uri);
    if (found) return found;
  }
  return null;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface ResourceActionsProps extends BoxProps {
  resource: Resource | null;
  slot?: string;
  onRun?(actionId: string): void;
}

/** The actions registered for this kind. An "Open with…" for behaviour. */
export const ResourceActions = defineComponent<ResourceActionsProps>('ResourceActions', (props) => {
  const runtime = useRuntime();
  const { resource, slot = 'context', onRun, ...rest } = props;
  const app = runtime.app();
  if (!resource || !app) return null;

  const actions = app.resources.actionsFor(resource.kind, slot);
  if (actions.length === 0) {
    return h(EmptyState, { title: 'No actions', ...rest });
  }

  return h(Menu, {
    items: actions.map((a) => ({ id: a.id, label: a.title, icon: a.icon })),
    onSelect: (id: string) => {
      onRun?.(id);
      const action = actions.find((a) => a.id === id);
      void action?.run({ uri: resource.uri }, {
        app,
        store: app.store,
        scopeId: null,
        source: 'menu',
      });
    },
    ...rest,
  });
});

export interface ResourceOpenWithProps extends BoxProps {
  resource: Resource | null;
  onChoose?(viewer: ResourceViewerDefinition): void;
}

export const ResourceOpenWith = defineComponent<ResourceOpenWithProps>('ResourceOpenWith', (props) => {
  const runtime = useRuntime();
  const { resource, onChoose, ...rest } = props;
  const app = runtime.app();
  if (!resource || !app) return null;

  const viewers = app.resources.viewersFor(resource.kind);
  return h(Menu, {
    items: viewers.map((v) => ({ id: v.id, label: v.title, description: v.kinds.join(', ') })),
    onSelect: (id: string) => {
      const viewer = viewers.find((v) => v.id === id);
      if (viewer) onChoose?.(viewer);
    },
    ...rest,
  });
});

export interface ResourceBreadcrumbProps extends BoxProps {
  uri: string | null;
  root?: string;
  onSelect?(uri: string): void;
}

export const ResourceBreadcrumb = defineComponent<ResourceBreadcrumbProps>('ResourceBreadcrumb', (props) => {
  const { uri, root, onSelect, ...rest } = props;
  if (!uri) return null;

  const stripped = root && uri.startsWith(root) ? uri.slice(root.length) : uri;
  const parts = stripped.split('/').filter((p) => p !== '');

  let accumulated = root ?? '';
  const items = parts.map((part) => {
    accumulated = `${accumulated}/${part}`.replace(/\/+/g, '/');
    return { id: accumulated, label: part };
  });

  return h(Breadcrumb, { items, maxItems: 5, onSelect, ...rest });
});

export const RESOURCE_COMPONENTS: ComponentDefinition[] = [
  {
    component: 'TextViewer',
    category: 'resource',
    renderer: { kind: 'function', render: TextViewer },
    opens: { resourceKinds: ['file.text'], title: 'Plain text', priority: 10, mode: 'view' },
    description: 'Plain text with a line-number gutter.',
  },
  {
    component: 'MarkdownViewer',
    category: 'resource',
    renderer: { kind: 'function', render: MarkdownViewer },
    opens: { resourceKinds: ['file.markdown'], title: 'Markdown', priority: 50, mode: 'view' },
    description: 'Headings, lists, rules, quotes and fenced code.',
  },
  {
    component: 'FallbackViewer',
    category: 'resource',
    renderer: { kind: 'function', render: FallbackViewer },
    description: 'What an unregistered kind gets.',
  },
  { component: 'ResourceView', category: 'resource', renderer: { kind: 'function', render: ResourceView }, description: 'Displays a resource through the registry.' },
  { component: 'ResourceExplorer', category: 'resource', renderer: { kind: 'function', render: ResourceExplorer }, description: 'Browse and open resources.' },
  { component: 'ResourceActions', category: 'resource', renderer: { kind: 'function', render: ResourceActions }, description: 'Actions registered for a kind.' },
  { component: 'ResourceOpenWith', category: 'resource', renderer: { kind: 'function', render: ResourceOpenWith }, description: 'Choose among registered viewers.' },
  { component: 'ResourceBreadcrumb', category: 'resource', renderer: { kind: 'function', render: ResourceBreadcrumb }, description: 'The path to a resource.' },
];
