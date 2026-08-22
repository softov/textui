import type { ComponentDefinition } from '../types/component-registry.js';
import type { BoxProps } from '../jsx/intrinsics.js';
import type { BindingPath, ComponentNode } from '../types/graph.js';
import type { Resource, ResourceRendererDefinition } from '../types/resource.js';
import type { CommandContext, CommandDefinition } from '../types/command.js';
import type { ReactiveStore } from '../types/store.js';
import type { TextUIApp } from '../types/app.js';
import { h, defineComponent } from '../jsx/factory.js';
import {
  createContext, useContext, useEffect, useFocusScope, useRef, useRuntime, useState,
  useStoreValue, useTask,
} from '../runtime/hooks.js';
import { escapeSegment } from '../util/paths.js';
import { EmptyState, ErrorState, Spinner } from './display.js';

/**
 * Panels.
 *
 * A resource is a file, a record, a log; a panel is a place one is being
 * shown, and the renderer is a late-bound choice between the components
 * registered for that kind. Those are three separate things, and every gain
 * here comes from keeping them separate:
 *
 *  - the same resource can be open in two panels at once, as source in one and
 *    rendered in the other, over one buffer - so an edit in either shows in
 *    both;
 *  - "open with" is one list from one registry, so a new renderer arriving
 *    from an extension is offered everywhere without anything being told;
 *  - and where a panel is looking - scroll, caret, which node was expanded -
 *    belongs to the panel rather than to whichever component happens to be
 *    drawing it, so every renderer remembers its place without implementing
 *    anything.
 *
 * That last one is what `usePanelState` is. A renderer asks for the state it
 * wants, in whatever shape suits it, and gets back what this panel last had
 * for this resource. The panel never knows what is in the record - a markdown
 * view keeps a row, an editor keeps a caret and two offsets, a tree keeps a
 * set of open nodes - which is precisely why it works for renderers that do
 * not exist yet.
 */

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

export function panelStatusPath(id: string): BindingPath {
  return `${panelPath(id)}/status` as BindingPath;
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

/** Ask a panel to take the keyboard as soon as it has something that can. */
export function claimPanel(store: ReactiveStore, id: string): void {
  store.set(panelClaimPath(id), (store.get<number>(panelClaimPath(id)) ?? 0) + 1);
}

export interface PanelRenderer {
  id: string;
  title: string;
  /** Whether what is on screen can write the resource back. */
  saves: boolean;
}

export function panelRenderer(store: ReactiveStore, id: string): PanelRenderer | null {
  return store.get<PanelRenderer>(panelRendererPath(id)) ?? null;
}

export interface PanelView {
  /** Which renderer this panel uses for this resource. */
  renderer?: string;
  /** Opaque, and owned by whichever renderer is showing. */
  state?: Record<string, unknown>;
}

export function activePanel(store: ReactiveStore): string | null {
  return store.get<string>(PANEL_PATH) ?? null;
}

export function panelUri(store: ReactiveStore, id: string): string | null {
  return store.get<string>(panelUriPath(id)) ?? null;
}

export function panelView(store: ReactiveStore, id: string, uri: string): PanelView {
  return store.get<PanelView>(panelViewPath(id, uri)) ?? {};
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

export function kindRenderer(store: ReactiveStore, kind: string): string | null {
  return store.get<string>(kindRendererPath(kind)) ?? null;
}

export function setKindRenderer(store: ReactiveStore, kind: string, renderer: string): void {
  store.set(kindRendererPath(kind), renderer);
}

/** Remember which renderer this panel uses for this resource. */
export function setPanelRenderer(
  store: ReactiveStore,
  id: string,
  uri: string,
  renderer: string | null,
): void {
  const view = panelView(store, id, uri);
  const next: PanelView = { ...view };
  if (renderer === null) delete next.renderer;
  else next.renderer = renderer;
  store.set(panelViewPath(id, uri), next);
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

const PanelContext = createContext<PanelHandle | null>('Panel', null);

/** The panel a renderer is drawing in, or null when it is mounted bare. */
export function usePanel(): PanelHandle | null {
  return useContext(PanelContext);
}

/** Where a renderer with no panel keeps state, so the hook is always safe. */
const LOOSE = '$/local/panel/loose' as BindingPath;

function same(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) if (!Object.is(a[key], b[key])) return false;
  return true;
}

/**
 * State that belongs to this panel showing this resource.
 *
 * `useState`, except that it survives the renderer being swapped, the tab
 * being switched away and back, and the component unmounting - and does not
 * survive being carried to another panel, because where the other panel is
 * looking is its own business.
 *
 * A renderer mounted outside a panel gets ordinary component state, so nothing
 * has to check whether it is in one.
 */
export function usePanelState<T extends Record<string, unknown>>(
  defaults: T,
): [T, (patch: Partial<T>) => void] {
  const runtime = useRuntime();
  const panel = usePanel();
  const path = panel ? panelViewPath(panel.id, panel.uri) : LOOSE;
  const stored = useStoreValue<PanelView>(path);
  const [local, setLocal] = useState<Record<string, unknown>>({});

  const remembered = panel ? (stored?.state ?? {}) : local;
  const value = { ...defaults, ...remembered } as T;

  const set = (patch: Partial<T>): void => {
    if (panel) {
      // Read the store rather than the render's snapshot: two sets in one
      // frame - a caret move that also scrolls - would otherwise have the
      // second overwrite the first with stale neighbours.
      const view = runtime.store.get<PanelView>(path) ?? {};
      const base = view.state ?? {};
      const next = { ...base, ...patch };
      if (same(base, next)) return;
      runtime.store.set(path, { ...view, state: next });
      return;
    }
    setLocal((prev) => (same(prev, { ...prev, ...patch }) ? prev : { ...prev, ...patch }));
  };

  return [value, set];
}

/**
 * One line about what this panel is doing, for whoever draws a status bar.
 *
 * A renderer knows things nothing outside it can compute - how much is
 * selected, which hunk is under the caret, how many matches are left - and a
 * status bar wants them without knowing which renderer is mounted. Publishing
 * it here means the bar reads one path and every renderer, present and future,
 * can fill it.
 */
export function usePanelStatus(text: string | null): void {
  const runtime = useRuntime();
  const panel = usePanel();
  const id = panel?.id ?? null;

  useEffect(() => {
    if (id === null) return;
    runtime.store.set(panelStatusPath(id), text);
    return () => { runtime.store.set(panelStatusPath(id), null); };
  }, [id, text]);
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
   */
  const previous = useRef<string | null>(null);
  const swapped = previous.current !== null && previous.current !== (chosen?.id ?? null);
  if (chosen) previous.current = chosen.id;

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

// ------------------------------------------------------------------ commands

interface Choice {
  def: ResourceRendererDefinition;
  label: string;
  kind: string;
}

/**
 * The renderers on offer for whatever the focused panel is showing.
 *
 * Titles are what a person picks from, so a title that two renderers share is
 * disambiguated by the component behind it rather than being offered twice.
 */
async function choicesFor(app: TextUIApp, uri: string | null): Promise<Choice[]> {
  if (uri === null) return [];
  const resource = await app.resources.stat(uri);
  if (!resource) return [];

  const renderers = app.resources.renderersFor(resource.kind);
  const counts = new Map<string, number>();
  for (const r of renderers) counts.set(r.title, (counts.get(r.title) ?? 0) + 1);

  return renderers.map((def) => ({
    def,
    kind: resource.kind,
    label: (counts.get(def.title) ?? 0) > 1 ? `${def.title} (${def.component})` : def.title,
  }));
}

function apply(
  app: TextUIApp,
  id: string | null,
  uri: string | null,
  choice: Choice | undefined,
): void {
  if (id === null || uri === null || !choice) return;
  setPanelRenderer(app.store, id, uri, choice.def.id);
  // And against the kind, because a person who opens one markdown as source is
  // usually saying something about markdown. The file's own answer still wins
  // wherever there is one.
  setKindRenderer(app.store, choice.kind, choice.def.id);
  // Asking for a different view of something is asking to look at it.
  claimPanel(app.store, id);
}

/**
 * The panel commands every application gets.
 *
 * They are here rather than in each host because the list they act on comes
 * from the registry, not from the host: an application that mounts a panel has
 * already said everything it needs to say for "open with" to work. What a host
 * still chooses is the keys.
 */
export function panelCommands(app: TextUIApp): CommandDefinition[] {
  const current = (args: Record<string, unknown>, ctx: CommandContext): string | null =>
    (args.panel as string | undefined) ?? activePanel(ctx.store);

  /*
   * Which resource to act on.
   *
   * The panel publishes what it is showing from an effect, so a caller that
   * opens a file and asks to edit it in the same tick would be acting on
   * whatever the panel had a frame ago. A caller that knows the URI says so
   * and the choice is remembered against it, ready for the panel that is about
   * to draw it.
   */
  const targetUri = (args: Record<string, unknown>, id: string | null): string | null =>
    (args.uri as string | undefined) ?? (id === null ? null : panelUri(app.store, id));

  return [
    {
      id: 'panel.openWith',
      title: 'Open With…',
      category: 'View',
      slots: ['palette'],
      when: PANEL_PATH,
      args: [{
        name: 'renderer',
        type: 'string' as const,
        required: true,
        description: 'How to show this resource',
        choices: async () => {
          const id = activePanel(app.store);
          return (await choicesFor(app, id === null ? null : panelUri(app.store, id)))
            .map((c) => c.label);
        },
      }],
      run: async (args: Record<string, unknown>, ctx: CommandContext) => {
        const id = current(args, ctx);
        const uri = targetUri(args, id);
        const label = String(args.renderer ?? '');
        const choices = await choicesFor(app, uri);
        apply(app, id, uri, choices.find((c) => c.label === label || c.def.id === label));
      },
    },
    {
      id: 'panel.nextRenderer',
      title: 'Next View',
      category: 'View',
      slots: ['palette'],
      when: PANEL_PATH,
      run: async (args: Record<string, unknown>, ctx: CommandContext) => {
        const id = current(args, ctx);
        const uri = targetUri(args, id);
        if (id === null || uri === null) return;
        const choices = await choicesFor(app, uri);
        if (choices.length < 2) return;

        const at = panelView(app.store, id, uri).renderer
          ?? defaultRenderer(choices.map((c) => c.def))?.id;
        const index = choices.findIndex((c) => c.def.id === at);
        apply(app, id, uri, choices[(index + 1) % choices.length]);
      },
    },
    {
      id: 'panel.toggleEdit',
      title: 'Edit / View',
      category: 'View',
      slots: ['palette'],
      when: PANEL_PATH,
      run: async (args: Record<string, unknown>, ctx: CommandContext) => {
        const id = current(args, ctx);
        const uri = targetUri(args, id);
        if (id === null || uri === null) return;
        const choices = await choicesFor(app, uri);
        const defs = choices.map((c) => c.def);
        const at = panelView(app.store, id, uri).renderer ?? defaultRenderer(defs)?.id;
        const showing = defs.find((d) => d.id === at);

        // Back to whatever this kind opens as, or forward to whatever writes
        // it. Not a cycle: the footer says "edit / view", and a key that says
        // one thing and does another is worse than a key that does less.
        const next = showing?.saves === true
          ? defaultRenderer(defs.filter((d) => d.saves !== true))
          : defs.find((d) => d.saves === true);
        apply(app, id, uri, choices.find((c) => c.def.id === next?.id));
      },
    },
  ];
}
