import type {
  RenderOutput,
  ComponentDefinition,
  BoxProps,
  Resource,
  ResourceViewerDefinition,
} from '@textui/core';
import {
  h,
  defineComponent,
  chorded,
  useFocus,
  useInput,
  useMeasure,
  useMemo,
  useRuntime,
  useState,
  useTheme,
  useEffect,
  layoutMarkdown,
} from '@textui/core';
import {
  usePanelState,
  Tree,
  CodeViewer,
  MarkdownView,
  ResourcePanel,
  useDecorations,
  type TreeNode,
  EmptyState,
  ErrorState,
  KeyValue,
  Spinner,
  Breadcrumb,
  Menu,
  viewportRows,
} from '@textui/widgets';
import { useDocument } from '../use-document.js';

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

export const TextViewer: (props: TextViewerProps) => RenderOutput = defineComponent<TextViewerProps>('TextViewer', (props) => {
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
export const MarkdownViewer: (props: MarkdownViewerProps) => RenderOutput = defineComponent<MarkdownViewerProps>('MarkdownViewer', (props) => {
  const theme = useTheme();
  const { resource, uri, content, ...rest } = props;
  const doc = useDocument(content === undefined ? (uri ?? resource?.uri ?? null) : null);
  const measured = useMeasure();
  const focus = useFocus({});
  /*
   * Counted in rendered rows, not source lines, which is why it is not the
   * `top` an editor keeps: one heading is one row, one paragraph is several,
   * and a fence is its lines plus two rules. A key of its own says so - the
   * panel record is shared, and two renderers agreeing to disagree about what
   * a number means is how a restored position lands in the wrong place.
   */
  const [view, setView] = usePanelState({ row: 0 });
  const top = view.row;
  const setTop = (next: number): void => setView({ row: next });

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
  //
  // Whether a fence is *ruled* is part of that count and not a detail of how
  // it is painted: a borderless theme draws no top and bottom rule, so a fence
  // that reserved two rows for them left two blank rows at the foot of every
  // screen and stopped two rows short of the end. `paper` is borderless, and
  // it is the default.
  const ruled = theme.border !== 'none';
  const rowsOfDoc = useMemo(
    () => layoutMarkdown(text, {
      width: measured.width,
      bullet: theme.glyphs.bulletFilled,
      quoteBar: theme.borderChars().left,
      ruled,
    }),
    [text, measured.width, theme, ruled],
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
  //
  // The rows are painted by `MarkdownView`, which is the same painter a
  // message in a transcript uses. What is left here is the half a *viewer*
  // owns and a block of prose does not: where the window is, and the keys that
  // move it.
  const rows = viewportRows({ flex: 1 }, measured, rowsOfDoc.length);
  const maxTop = Math.max(0, rowsOfDoc.length - rows);
  const first = Math.min(top, maxTop);

  useInput(
    (event) => {
      if (chorded(event)) return false;
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

  return h(MarkdownView, {
    id: focus.id,
    rows: rowsOfDoc,
    window: { first, count: rows },
    flex: 1,
    overflow: 'hidden',
    ...rest,
  });
});

export interface FallbackViewerProps extends BoxProps {
  resource?: Resource;
  uri?: string;
}

/** What an unknown kind gets: its metadata, honestly labelled. */
export const FallbackViewer: (props: FallbackViewerProps) => RenderOutput = defineComponent<FallbackViewerProps>('FallbackViewer', (props) => {
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
  /** The panel this is, when the host has more than one. */
  id?: string;
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
  autoFocus?: boolean;
}

/**
 * Show a resource using whichever renderer the registry picks.
 *
 * A panel with the older vocabulary on the outside: `viewerId` is a renderer,
 * `mode` is an intent. What it adds over `ResourcePanel` is the fallback for a
 * kind nothing is registered for, which is a documents concern - core has no
 * opinion about what an unrenderable file should look like.
 */
export const ResourceView: (props: ResourceViewProps) => RenderOutput = defineComponent<ResourceViewProps>('ResourceView', (props) => {
  const { uri, id, viewerId, mode, viewerProps, autoFocus, ...rest } = props;

  return h(ResourcePanel, {
    uri,
    ...(id !== undefined ? { id } : {}),
    ...(viewerId !== undefined ? { renderer: viewerId } : {}),
    ...(mode !== undefined ? { mode } : {}),
    ...(viewerProps !== undefined ? { rendererProps: viewerProps } : {}),
    ...(autoFocus !== undefined ? { autoFocus } : {}),
    fallbackComponent: 'FallbackViewer',
    ...rest,
  });
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
  /**
   * What a folder looks like, open and shut.
   *
   * The tree draws a chevron by default, which says whether a row is expanded
   * and nothing about what kind of row it is. An application with its own icon
   * vocabulary - textide has one - says which marks mean folder here, rather
   * than this file growing an opinion about glyphs it cannot pick for every
   * terminal.
   */
  folderIcons?: { folder: string; folderOpen: string };
  /**
   * What a file looks like when nothing has said otherwise.
   *
   * The registry answers for a kind somebody has described - a markdown viewer
   * names and colours markdown - and this is the row underneath: a file whose
   * kind nobody has claimed still deserves to look like a file rather than
   * like nothing. Passed in for the same reason `folderIcons` is.
   */
  fileIcon?: string;
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
export const ResourceExplorer: (props: ResourceExplorerProps) => RenderOutput = defineComponent<ResourceExplorerProps>('ResourceExplorer', (props) => {
  const runtime = useRuntime();
  const {
    root, onOpen, onSelect, selectedUri, visibleRows, folderIcons, fileIcon,
    autoFocus, ...rest
  } = props;
  const app = runtime.app();

  /*
   * Whatever anything has to say about these files.
   *
   * The explorer knows nothing about git, or errors, or search results - it
   * asks for the mark on a URI and draws it. One subscription for the whole
   * tree, because a hook per row would move the hook count as the list does.
   */
  const decorationFor = useDecorations();

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
    const mark = decorationFor(resource.uri);
    /*
     * What this kind of thing looks like, asked of the registry.
     *
     * The renderer that opens a markdown file is the thing that knows what a
     * markdown file is, so it names and colours its own kind - and an
     * extension that brings a viewer brings its icon with it, without this
     * component learning what it opened.
     *
     * Not for a container: `Tree` draws the twisty for anything expandable,
     * and a second glyph beside it is how a folder ends up wearing two.
     */
    const look = container || !app ? {} : app.resources.appearanceOf(resource);
    const size = resource.metadata.size !== undefined
      ? formatSize(resource.metadata.size)
      : undefined;
    return {
      id: resource.uri,
      label: resource.metadata.name,
      // No icon for a container: `Tree` already draws the twisty for anything
      // expandable, and setting a chevron here too is how a folder ends up
      // wearing two of them.
      hasChildren: container,
      children: kids?.map(toNode),
      // A mark wins the column: that a file is modified is worth more than how
      // many bytes it is, and the size is still one keystroke away.
      ...(mark?.badge !== undefined ? { meta: mark.badge } : size !== undefined ? { meta: size } : {}),
      // A decoration outranks a kind for both: "this file has changed" is news
      // and "this is a markdown file" is not, and the two would otherwise be
      // saying different things in the same two cells.
      ...(mark?.tone !== undefined ? { tone: mark.tone }
        : look.tone !== undefined ? { tone: look.tone } : {}),
      ...(mark?.icon !== undefined ? { icon: mark.icon }
        : look.icon !== undefined ? { icon: look.icon }
        : !container && fileIcon !== undefined ? { icon: fileIcon } : {}),
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
    ...(folderIcons
      ? { twistyOpen: folderIcons.folderOpen, twistyClosed: folderIcons.folder }
      : {}),
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
export const ResourceActions: (props: ResourceActionsProps) => RenderOutput = defineComponent<ResourceActionsProps>('ResourceActions', (props) => {
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

export const ResourceOpenWith: (props: ResourceOpenWithProps) => RenderOutput = defineComponent<ResourceOpenWithProps>('ResourceOpenWith', (props) => {
  const runtime = useRuntime();
  const { resource, onChoose, ...rest } = props;
  const app = runtime.app();
  if (!resource || !app) return null;

  // Every renderer, not only the viewers: an editor and a component that
  // declared `opens` are two more ways to open this, and a menu called "open
  // with" that omits them is answering a narrower question than it asks.
  const viewers = app.resources.renderersFor(resource.kind);
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

export const ResourceBreadcrumb: (props: ResourceBreadcrumbProps) => RenderOutput = defineComponent<ResourceBreadcrumbProps>('ResourceBreadcrumb', (props) => {
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
