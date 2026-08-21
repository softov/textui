import type { ComponentDefinition } from '@textui/core';
import type { BoxProps } from '@textui/core';
import type { Resource, ResourceViewerDefinition } from '@textui/core';
import type { ResolvedTheme, StyleColor } from '@textui/core';
import { h, defineComponent } from '@textui/core';
import {
  useFocus, useInput, useMeasure, useMemo, useRuntime, useState, useTheme,
  useTask, useEffect,
} from '@textui/core';
import { repeatToWidth, stringWidth, wrapText } from '@textui/core';
import { useDocument } from '../use-document.js';
import { Tree, CodeViewer, type TreeNode } from '@textui/core';
import { EmptyState, ErrorState, KeyValue, Spinner } from '@textui/core';
import { Breadcrumb, Menu } from '@textui/core';
import { viewportRows } from '@textui/core';

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
  const theme = useTheme();
  const { resource, uri, content, ...rest } = props;
  const target = content === undefined ? (uri ?? resource?.uri ?? null) : null;
  // A buffer rather than a read, so an action that rewrites the text shows its
  // work here instead of requiring a save first.
  const doc = useDocument(target);

  if (content === undefined && doc.status === 'running') {
    return h(Spinner, { label: `Loading${theme.glyphs.ellipsis}`, ...rest });
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
 * A rendered Markdown document, scrolled by the rows it draws.
 *
 * The formatting is deliberately small - see `layoutMarkdown` below, which is
 * where the document becomes a flat list of rows this only has to window.
 */
export const MarkdownViewer = defineComponent<MarkdownViewerProps>('MarkdownViewer', (props) => {
  const theme = useTheme();
  const { resource, uri, content, ...rest } = props;
  const doc = useDocument(content === undefined ? (uri ?? resource?.uri ?? null) : null);
  const measured = useMeasure();
  const focus = useFocus({});
  const [top, setTop] = useState(0);

  const text = content ?? doc.content;

  // Lay the whole document out before deciding what is on screen.
  //
  // The window has to be measured in the rows the pane will *draw*, not in the
  // lines the file happens to contain: one source line becomes three rows when
  // it wraps, none when it is a fence marker, and a fence becomes its lines
  // plus two rules. Slicing the source and hoping is what silently cut the
  // last few rows off every screen and made the tail of a long file
  // unreachable - `end` would stop three paragraphs early, because the scroll
  // limit was counted in the wrong unit.
  const rowsOfDoc = useMemo(
    () => layoutMarkdown(text.split('\n'), measured.width, theme),
    [text, measured.width, theme],
  );

  if (content === undefined && doc.status === 'running') {
    return h(Spinner, { label: `Loading${theme.glyphs.ellipsis}`, ...rest });
  }
  if (content === undefined && doc.status === 'error') {
    return h(ErrorState, { error: doc.error, ...rest });
  }

  // Render a window, not the file. A README is short; a changelog is not, and
  // one instance per line is the difference between a pane that opens and one
  // that stalls the frame.
  const rows = viewportRows({ flex: 1 }, measured, rowsOfDoc.length);
  const maxTop = Math.max(0, rowsOfDoc.length - rows);
  const first = Math.min(top, maxTop);
  const window = rowsOfDoc.slice(first, first + rows);

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
  for (let i = 0; i < window.length;) {
    const row = window[i] as MarkdownRow;
    const key = first + i;

    if (row.kind === 'fence') {
      // A fence that the window cuts through is still one box, with only the
      // rules that are actually on screen.
      let end = i;
      while (end < window.length) {
        const next = window[end] as MarkdownRow;
        if (next.kind !== 'fence' || next.fence !== row.fence) break;
        end++;
      }
      const group = window.slice(i, end) as Extract<MarkdownRow, { kind: 'fence' }>[];
      const code = group.filter((r) => r.part === 'code').map((r) => r.text ?? '');

      if (code.length === 0) {
        // Only one edge of the box is on screen, and a box one row tall cannot
        // say which. Drawn directly, so the seam between this row and the rest
        // of the fence is invisible as it scrolls past.
        out.push(h('text', {
          key,
          content: fenceEdge(theme, measured.width, group.some((r) => r.part === 'open')),
          fg: 'borderSubtle',
          wrap: 'none',
        }));
      } else {
        out.push(h('box', {
          key,
          border: {
            style: theme.border,
            color: 'borderSubtle',
            sides: {
              top: group.some((r) => r.part === 'open'),
              bottom: group.some((r) => r.part === 'close'),
              left: true,
              right: true,
            },
          },
          padding: [0, 1],
        }, h(CodeViewer, {
          content: code.join('\n'),
          lineNumbers: false,
          scrollbar: false,
          showCaret: false,
          // A fence inside a rendered document is typography, not a control.
          // Left focusable, every code block in a README becomes a tab stop -
          // so a file with two of them puts two things between the document
          // and the menu bar that nobody can do anything with.
          disabled: true,
        })));
      }
      i = end;
      continue;
    }

    if (row.kind === 'rule') {
      out.push(h('box', { key, height: 1, fill: theme.borderChars().top, fg: 'borderSubtle' }));
      i++;
      continue;
    }

    if (row.kind === 'heading') {
      out.push(h('text', {
        key,
        content: row.text,
        wrap: 'none',
        bold: row.level <= 2,
        underline: row.level === 1,
        fg: row.level <= 2 ? 'text' : 'muted',
      }));
      i++;
      continue;
    }

    if (row.prefix !== undefined) {
      out.push(h('box', { key, direction: 'row', gap: 1 },
        h('text', { content: row.prefix, fg: row.prefixFg ?? 'accent' }),
        h('text', { content: row.text, wrap: 'none', flex: 1, ...(row.fg ? { fg: row.fg } : {}) })));
      i++;
      continue;
    }

    out.push(h('text', { key, content: row.text, wrap: 'none', ...(row.fg ? { fg: row.fg } : {}) }));
    i++;
  }

  return h('box', {
    id: focus.id,
    role: 'document',
    direction: 'column',
    flex: 1,
    overflow: 'hidden',
    ...rest,
  }, ...out);
});

/**
 * One drawn row of a rendered document.
 *
 * Every variant is exactly one row tall, which is the whole point: it makes
 * "how far can this scroll" a length rather than an estimate. A fence is the
 * exception that proves it - it is several rows, so it becomes several rows
 * here, tagged with which fence they belong to so the renderer can put the
 * visible ones back into one box.
 */
type MarkdownRow =
  | { kind: 'rule' }
  | { kind: 'heading'; text: string; level: number }
  | { kind: 'text'; text: string; prefix?: string; prefixFg?: StyleColor; fg?: StyleColor }
  | { kind: 'fence'; fence: number; part: 'open' | 'code' | 'close'; text?: string };

/** The top or bottom edge of a fence, for when the window shows only that row. */
function fenceEdge(theme: ResolvedTheme, width: number, top: boolean): string {
  const chars = theme.borderChars();
  const [left, mid, right] = top
    ? [chars.topLeft, chars.top, chars.topRight]
    : [chars.bottomLeft, chars.bottom, chars.bottomRight];
  return `${left}${repeatToWidth(mid, Math.max(0, width - 2))}${right}`;
}

/** Wrap, unless nothing has been measured yet and there is no width to wrap to. */
function wrapAt(text: string, width: number): string[] {
  if (width <= 0) return [text];
  const wrapped = wrapText(text, width);
  return wrapped.length > 0 ? wrapped : [''];
}

/** Wrapped rows behind a gutter: the marker on the first, its width on the rest. */
function withPrefix(
  text: string,
  width: number,
  prefix: string,
  options: { continued?: string; prefixFg?: StyleColor; fg?: StyleColor } = {},
): MarkdownRow[] {
  const gutter = stringWidth(prefix);
  const rest = options.continued ?? ' '.repeat(gutter);
  return wrapAt(text, width <= 0 ? 0 : Math.max(1, width - gutter - 1)).map((line, index) => ({
    kind: 'text' as const,
    text: line,
    prefix: index === 0 ? prefix : rest,
    ...(options.prefixFg ? { prefixFg: options.prefixFg } : {}),
    ...(options.fg ? { fg: options.fg } : {}),
  }));
}

/**
 * A deliberately small Markdown layout: headings, emphasis, lists, rules, code
 * fences, block quotes. Not a parser - a formatter for the subset that appears
 * in READMEs and notes, which is what a terminal viewer is for.
 */
function layoutMarkdown(lines: string[], width: number, theme: ResolvedTheme): MarkdownRow[] {
  const rows: MarkdownRow[] = [];
  let fence = 0;
  let inFence = false;

  for (const line of lines) {
    if (line.trimStart().startsWith('```')) {
      rows.push({ kind: 'fence', fence, part: inFence ? 'close' : 'open' });
      if (inFence) fence++;
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      rows.push({ kind: 'fence', fence, part: 'code', text: line });
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = (heading[1] as string).length;
      for (const text of wrapAt(stripInline(heading[2] as string), width)) {
        rows.push({ kind: 'heading', text, level });
      }
      continue;
    }

    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      rows.push({ kind: 'rule' });
      continue;
    }

    const bullet = /^(\s*)[-*+]\s+(.*)$/.exec(line);
    if (bullet) {
      rows.push(...withPrefix(
        stripInline(bullet[2] as string),
        width,
        `${bullet[1]}${theme.glyphs.bulletFilled}`,
      ));
      continue;
    }

    const ordered = /^(\s*)(\d+)\.\s+(.*)$/.exec(line);
    if (ordered) {
      rows.push(...withPrefix(
        stripInline(ordered[3] as string),
        width,
        `${ordered[1]}${ordered[2]}.`,
      ));
      continue;
    }

    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      const bar = theme.borderChars().left;
      // The bar repeats down every row of the quote: a rule that stopped after
      // the first wrapped row would read as one quoted line and some prose.
      rows.push(...withPrefix(stripInline(quote[1] as string), width, bar, {
        continued: bar,
        prefixFg: 'borderSubtle',
        fg: 'muted',
      }));
      continue;
    }

    for (const text of wrapAt(stripInline(line), width)) {
      rows.push({ kind: 'text', text });
    }
  }

  // An unterminated fence still gets its closing rule, so the box reads as a
  // box rather than as something the renderer forgot to finish.
  if (inFence) rows.push({ kind: 'fence', fence, part: 'close' });

  return rows;
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
  /**
   * Props for whichever component the registry picks.
   *
   * The caller does not know which component that is - that is the point of
   * the registry - but it may still have something to say to it, like "you are
   * why the mode changed, so take focus".
   */
  viewerProps?: Record<string, unknown>;
}

/**
 * Show a resource using whichever viewer the registry picks. This is the
 * component an explorer mounts, and the reason the explorer needs no knowledge
 * of file types.
 */
export const ResourceView = defineComponent<ResourceViewProps>('ResourceView', (props) => {
  const theme = useTheme();
  const runtime = useRuntime();
  const { uri, viewerId, mode, viewerProps, ...rest } = props;
  const app = runtime.app();

  const task = useTask(async () => {
    if (!uri || !app) return null;
    return app.resources.stat(uri);
  }, [uri]);

  useEffect(() => {
    void task.run();
  }, [uri]);

  if (!uri) return h(EmptyState, { title: 'Nothing selected', ...rest });
  if (task.status === 'running') return h(Spinner, { label: `Loading${theme.glyphs.ellipsis}`, ...rest });
  if (task.status === 'error') return h(ErrorState, { error: task.error, ...rest });

  const resource = task.data;
  if (!resource) return h(EmptyState, { title: 'Not found', message: uri, ...rest });
  if (!app) return null;

  const node = app.resources.nodeFor(resource, { viewerId, mode });
  if (!node) return h(FallbackViewer, { resource, ...rest });

  return h('box', { direction: 'column', flex: 1, ...rest },
    viewerProps ? { ...node, ...viewerProps } : node);
});

export interface ResourceExplorerProps extends BoxProps {
  /** Root URI to browse. */
  root: string;
  /** Called when a resource is activated - enter, or a double click. */
  onOpen?(resource: Resource): void;
  /** Called as the selection moves, before anything is opened. */
  onSelect?(resource: Resource): void;
  selectedUri?: string;
  visibleRows?: number;
  /** Claim focus on mount, so an application has somewhere to start. */
  autoFocus?: boolean;
}

/**
 * Browse resources.
 *
 * It lists and selects; it does not show what is selected. A viewer is
 * `ResourceView`, and keeping them apart is what lets one tree drive two
 * views - or none - and what stops "the selected resource" from having to be
 * a single value somewhere global. The screen owns that relationship, because
 * only the screen knows how many views it has.
 *
 * Children load lazily on expand, because a provider may be a network and a
 * tree that eagerly walks one is a tree that hangs.
 */
export const ResourceExplorer = defineComponent<ResourceExplorerProps>('ResourceExplorer', (props) => {
  const runtime = useRuntime();
  const { root, onOpen, onSelect, selectedUri, visibleRows, autoFocus, ...rest } = props;
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

  // Select the first entry once the root has listed, so whatever is watching
  // the selection has something to show rather than an empty state nobody
  // asked for.
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
      // No icon for a container: `Tree` already draws the twisty for anything
      // expandable, and setting a chevron here too is how a folder ends up
      // wearing two of them.
      hasChildren: container,
      children: kids?.map(toNode),
      meta: resource.metadata.size !== undefined ? formatSize(resource.metadata.size) : undefined,
    };
  };

  const roots = (children[root] ?? []).map(toNode);
  const current = selectedUri ?? selected;

  if (error) return h(ErrorState, { error, title: 'Could not list resources', ...rest });

  const tree = h(Tree, {
    autoFocus,
    nodes: roots,
    selectedId: current ?? undefined,
    expandedIds: expanded,
    visibleRows,
    onToggle: (id: string, isExpanded: boolean) => {
      setExpanded(isExpanded ? [...expanded, id] : expanded.filter((e) => e !== id));
      if (isExpanded) load(id);
    },
    onSelect: (id: string) => {
      setSelected(id);
      const found = findResource(children, id);
      if (found) onSelect?.(found);
    },
    onActivate: (id: string) => {
      setSelected(id);
      const found = findResource(children, id);
      if (found) onOpen?.(found);
    },
    flex: 1,
  });

  return h('box', { direction: 'column', flex: 1, ...rest }, tree);
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
