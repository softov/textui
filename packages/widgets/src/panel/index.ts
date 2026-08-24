import type {
  BindingPath,
  CommandContext,
  CommandDefinition,
  ReactiveStore,
  ResourceRendererDefinition,
  TextUIApp,
} from '@textui/core';
import { useContext, useEffect, useRuntime, useState, useStoreValue } from '@textui/core';
import type { PanelHandle, PanelView } from './resource-panel.js';
import {
  PANEL_PATH,
  defaultRenderer,
  kindRendererPath,
  panelClaimPath,
  panelPath,
  panelRendererPath,
  panelUriPath,
  panelViewPath,
} from './resource-panel.js';
import { LOOSE, PanelContext } from './shared.js';

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
export * from './resource-panel.js';

export function panelStatusPath(id: string): BindingPath {
  return `${panelPath(id)}/status` as BindingPath;
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

export function activePanel(store: ReactiveStore): string | null {
  return store.get<string>(PANEL_PATH) ?? null;
}

export function panelUri(store: ReactiveStore, id: string): string | null {
  return store.get<string>(panelUriPath(id)) ?? null;
}

export function panelView(store: ReactiveStore, id: string, uri: string): PanelView {
  return store.get<PanelView>(panelViewPath(id, uri)) ?? {};
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

/** The panel a renderer is drawing in, or null when it is mounted bare. */
export function usePanel(): PanelHandle | null {
  return useContext(PanelContext);
}

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
