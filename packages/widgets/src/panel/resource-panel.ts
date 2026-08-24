import type {
  BindingPath,
  BoxProps,
  ComponentDefinition,
  ComponentNode,
  Resource,
  ResourceRendererDefinition,
} from '@textui/core';
import {
  defineComponent,
  escapeSegment,
  h,
  useEffect,
  useFocusScope,
  useRef,
  useRuntime,
  useStoreValue,
  useTask,
} from '@textui/core';
import { EmptyState, ErrorState, Spinner } from '../display/index.js';
import { LOOSE, PanelContext } from './shared.js';

/** Every panel's remembered state. */
export const PANELS_ROOT = '$/ui/panels';

/** Which panel the keyboard is in. */
export const PANEL_PATH = '$/ui/panel' as BindingPath;

export function panelPath(id: string): BindingPath {
  return `${PANELS_ROOT}/${escapeSegment(id)}` as BindingPath;
}

/** What one panel remembers about one resource. */
export function panelViewPath(id: string, uri: string): BindingPath {
  return `${panelPath(id)}/views/${escapeSegment(uri)}` as BindingPath;
}

export function panelUriPath(id: string): BindingPath {
  return `${panelPath(id)}/uri` as BindingPath;
}

/** Which renderer a panel settled on, published for whoever draws chrome. */
export function panelRendererPath(id: string): BindingPath {
  return `${panelPath(id)}/renderer` as BindingPath;
}

/**
 * A pending "put the keyboard in here", counted rather than flagged.
 *
 * A command can ask before the panel showing that resource has even rendered -
 * "open this file and edit it" is two calls in one tick - so the ask has to
 * survive until there is something to focus. A counter, because asking twice
 * in a row for the same panel is two asks.
 */
export function panelClaimPath(id: string): BindingPath {
  return `${panelPath(id)}/claim` as BindingPath;
}

export interface PanelView {
  /** Which renderer this panel uses for this resource. */
  renderer?: string;
  /** Opaque, and owned by whichever renderer is showing. */
  state?: Record<string, unknown>;
}

/**
 * Which renderer a *kind* opens with, once somebody has said.
 *
 * The per-resource memory answers "this file", and a person who opens one
 * markdown as source is usually telling you something about markdown rather
 * than about that file. So a choice is remembered twice: against the resource,
 * where it wins, and against its kind, where it becomes the answer for the
 * next file of that kind nobody has an opinion about yet.
 */
export const RENDERERS_ROOT = '$/ui/renderers';

export function kindRendererPath(kind: string): BindingPath {
  return `${RENDERERS_ROOT}/${escapeSegment(kind)}` as BindingPath;
}

/**
 * Which renderer a panel opens a resource with when it has no opinion.
 *
 * The highest-priority renderer that does not save. Opening a file is looking
 * at it: an editor is something you ask for, and a kind whose only renderer
 * writes back is the one case where asking is not required.
 */
export function defaultRenderer(
  renderers: ResourceRendererDefinition[],
): ResourceRendererDefinition | null {
  return renderers.find((r) => r.saves !== true) ?? renderers[0] ?? null;
}

// ------------------------------------------------------------------ context

export interface PanelHandle {
  id: string;
  uri: string;
  /** The renderer currently drawing, which may not be the remembered one. */
  renderer: string | null;
  resource: Resource;
}

// ------------------------------------------------------------------ component

export interface ResourcePanelProps extends BoxProps {
  /**
   * This panel's identity, and the focus scope it makes.
   *
   * A panel with no id still works and still remembers - it takes the scope id
   * the runtime generates - but that id dies with the mount, so it forgets
   * when it is unmounted. Naming a panel is what makes it a place.
   */
  id?: string;
  uri: string | null;
  /** Force a renderer, ignoring what the panel remembers. */
  renderer?: string;
  /**
   * What the caller wants, when it has no renderer in mind: `edit` asks for
   * one that writes back. An intent, resolved against whatever is registered -
   * not a second way of naming a component.
   */
  mode?: 'view' | 'edit';
  /** Props for whichever renderer is chosen. The caller does not know which. */
  rendererProps?: Record<string, unknown>;
  /** Component to mount when nothing is registered for the kind. */
  fallbackComponent?: string;
  /** Claim the keyboard when nothing else holds it. */
  autoFocus?: boolean;
  emptyTitle?: string;
}

/**
 * A place a resource is shown.
 *
 * `ResourcePanel` rather than `Panel` only because `Panel` is already a titled
 * box in this catalog. The vocabulary everywhere else - `usePanelState`,
 * `panelViewPath`, `$/ui/panels` - is the short word.
 *
 * It resolves the resource, picks a renderer, mounts it, and owns the focus
 * scope and the remembered state around it. What it deliberately does not own
 * is a tab strip, a title or a border: a panel is one slot, and how a host
 * arranges its slots is the host's business.
 */
export const ResourcePanel = defineComponent<ResourcePanelProps>('ResourcePanel', (props) => {
  const runtime = useRuntime();
  const {
    id: named, uri, renderer, mode, rendererProps, fallbackComponent, autoFocus,
    emptyTitle, ...rest
  } = props;
  const app = runtime.app();
  const scope = useFocusScope({
    ...(named !== undefined ? { id: named } : {}),
    ...(autoFocus === true ? { autoFocus: true } : {}),
  });
  const id = scope;
  const focused = useStoreValue<string | null>('$/focus/scope', null);
  const active = useStoreValue<string | null>(PANEL_PATH, null);

  // What this panel is showing, published for commands that act on it and for
  // a host that would rather ask the store than thread props back up.
  useEffect(() => {
    runtime.store.set(panelUriPath(id), uri);
    return () => {
      // An unnamed panel's id was invented for this mount, so what it
      // remembered can never be found again - it goes with it rather than
      // accumulating in the store one screen at a time.
      if (named === undefined) runtime.store.set(panelPath(id), null);
      else runtime.store.set(panelUriPath(id), null);
    };
  }, [id, uri]);

  // The panel the keyboard is in is wherever the keyboard actually is - and
  // the first panel to exist, before anything has been focused at all, so a
  // command run from the palette on a fresh screen still has a target.
  useEffect(() => {
    if (focused === scope || active == null) runtime.store.set(PANEL_PATH, id);
  }, [focused, scope, id, active]);

  // And no panel at all once the last one goes: the panel commands exist only
  // while there is somewhere for them to act, so an application with no panels
  // does not carry "Open With" in its palette. Whichever panel is still
  // mounted takes the mark back on the next frame.
  useEffect(() => () => {
    if (runtime.store.get<string>(PANEL_PATH) === id) runtime.store.set(PANEL_PATH, null);
  }, [id]);

  const task = useTask(async () => {
    if (!uri || !app) return null;
    return app.resources.stat(uri);
  }, [uri]);

  useEffect(() => { void task.run(); }, [uri]);

  // Subscribing here, not only in the renderer: picking "open with" writes the
  // choice into this record, and the panel is what has to redraw.
  const view = useStoreValue<PanelView>(uri ? panelViewPath(id, uri) : LOOSE);
  const resourceKind = task.status === 'success' ? (task.data?.kind ?? null) : null;
  // Subscribed, not just read: choosing how markdown opens in one panel is an
  // answer every other panel showing markdown should pick up.
  const forKind = useStoreValue<string>(kindRendererPath(resourceKind ?? '\u0000'));

  /*
   * What the caller named, then what the caller asked for, then what this
   * panel last used for this resource, then what the kind opens as. A caller
   * that says nothing gets the remembered choice, which is what makes "open
   * this json as a tree" stick.
   */
  const resource = task.status === 'success' ? task.data : null;
  const renderers = resource && app ? app.resources.renderersFor(resource.kind) : [];
  const asked = mode === 'edit'
    ? renderers.find((r) => r.saves === true)
    : mode === 'view'
      ? defaultRenderer(renderers.filter((r) => r.saves !== true))
      : undefined;
  const chosen =
    (renderer !== undefined ? renderers.find((r) => r.id === renderer) : undefined) ??
    asked ??
    renderers.find((r) => r.id === view?.renderer) ??
    renderers.find((r) => r.id === forKind) ??
    defaultRenderer(renderers);

  // Published rather than returned, because what is on screen is a fact a
  // status bar, a menu and a key hint all want and none of them is this
  // panel's parent. Resolved here, since the choice is made here.
  useEffect(() => {
    runtime.store.set(
      panelRendererPath(id),
      chosen ? { id: chosen.id, title: chosen.title, saves: chosen.saves === true } : null,
    );
    return () => { runtime.store.set(panelRendererPath(id), null); };
  }, [id, chosen?.id ?? null]);

  /*
   * Swapping the renderer puts the keyboard in the panel.
   *
   * Asking for a different view of a thing is asking to look at it, and the
   * swap unmounts whatever had focus - so without this the new renderer draws
   * perfectly and reads no keys, which looks like a broken viewer rather than
   * an unfocused one. It is handed to the renderer as `autoFocus` rather than
   * pushed from here afterwards, because the mounting render is the first
   * moment the thing that should have focus exists.
   *
   * Only on a *change*: a panel appearing on screen is not a reason to take
   * the keyboard off whatever the person was already using.
   *
   * And only for the *same resource*. This used to compare renderer ids and
   * nothing else, so walking a tree from a markdown file to a JSON one was a
   * swap - the renderer changed because the file did - and the keyboard left
   * the tree in the middle of browsing it. A different view of one thing is a
   * request; a different thing is just the next thing.
   */
  const previous = useRef<{ uri: string | null; renderer: string | null } | null>(null);
  const before = previous.current;
  const swapped = before !== null
    && before.uri === uri
    && before.renderer !== (chosen?.id ?? null);
  if (chosen) previous.current = { uri, renderer: chosen.id };

  // Or because a command asked outright, which is the same thing arriving a
  // frame earlier: "open this and edit it" writes the choice before this panel
  // has drawn once, so there is no swap to notice.
  const claim = useStoreValue<number>(panelClaimPath(id), 0) ?? 0;
  useEffect(() => {
    if (claim > 0 && chosen) runtime.store.set(panelClaimPath(id), 0);
  }, [id, claim, chosen?.id ?? null]);

  if (!uri) return h(EmptyState, { title: emptyTitle ?? 'Nothing selected', ...rest });
  if (!app) return null;
  if (task.status === 'running' || task.status === 'idle') {
    return h(Spinner, { label: 'Loading…', ...rest });
  }
  if (task.status === 'error') return h(ErrorState, { error: task.error, ...rest });
  if (!resource) return h(EmptyState, { title: 'Not found', message: uri, ...rest });

  if (!chosen) {
    return h('box', { direction: 'column', flex: 1, id: scope, ...rest },
      fallbackComponent
        ? { component: fallbackComponent, resource, uri }
        : h(EmptyState, { title: 'No renderer', message: resource.kind }));
  }

  const node: ComponentNode = {
    component: chosen.component,
    resource,
    uri,
    ...(swapped || claim > 0 ? { autoFocus: true } : {}),
    ...(rendererProps ?? {}),
  } as ComponentNode;

  const handle: PanelHandle = { id, uri, renderer: chosen.id, resource };

  return h('box', { direction: 'column', flex: 1, id: scope, ...rest },
    h(PanelContext.Provider, { value: handle }, node));
});

export const PANEL_COMPONENTS: ComponentDefinition[] = [
  {
    component: 'ResourcePanel',
    category: 'resource',
    renderer: { kind: 'function', render: ResourcePanel },
    description: 'A place a resource is shown, by whichever renderer is registered for it.',
  },
];
