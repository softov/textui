import type {
  CreateAppOptions, InspectorNode, TextUIApp,
} from '../types/app.js';
import type { BindingPath, ComponentNode } from '../types/graph.js';
import type { Disposable } from '../types/disposable.js';
import type { ResourceAdapter } from '../types/adapter.js';
import type { Size, Rect } from '../types/geometry.js';
import type { ResolvedTheme } from '../types/theme.js';
import type { TerminalCapabilities, CapabilityOverrides } from '../types/capabilities.js';
import type { InputEvent, KeyEvent, MouseEvent } from '../types/input.js';
import type { LayerEntry } from '../types/layer.js';
import type { Instance } from '../runtime/instance.js';
import type { Runtime } from '../runtime/runtime.js';
import type { LayoutBox } from '../render/layout.js';

import { Buffer } from '../render/buffer.js';
import { diffFrame, type Frame } from '../render/diff.js';
import { layout } from '../render/layout.js';
import { buildBoxes, paintTree, type PaintEnv } from '../runtime/paint.js';
import { collectEffects, disposeTree, renderTree } from '../runtime/reconcile.js';
import { flushMeasures, focusScopeOf } from '../runtime/hooks.js';
import { walkInstances } from '../runtime/instance.js';
import type { InteractionState } from '../runtime/style.js';

import { serviceKey } from '../types/services.js';
import { createStore } from '../core/store.js';
import { createEvents } from '../core/events.js';
import { createWhen } from '../core/when.js';
import { createComponents } from '../core/components.js';
import { createServices } from '../core/services.js';
import { createCommands } from '../core/commands.js';
import { createKeybindings } from '../core/keybindings.js';
import { createFocus } from '../core/focus.js';
import { createLayers } from '../core/layers.js';
import { createAnimation } from '../core/animation.js';
import { createI18n } from '../core/i18n.js';
import { createSurfaces, createLayouts, createShells } from '../core/surfaces.js';
import { createNavigation } from '../core/navigation.js';
import { SCREEN_COMPONENTS } from '../ui/screen.js';
import type { ScreenEntry } from '../types/navigation.js';
import { createResources } from '../core/resources.js';
import { createSyntax } from '../core/syntax.js';
import { createManifests } from '../core/manifest.js';
import { createThemes } from '../themes/registry.js';
import { PRIMITIVES } from '../ui/primitives.js';
import { ZERO_EDGES } from '../types/geometry.js';
import { createBag } from '../util/disposable.js';

/**
 * The application.
 *
 * Everything here is wiring: registries in, a frame loop, input routed to
 * focus and commands, and deterministic teardown. The interesting decisions
 * live in the pieces this assembles - what makes an app an app is that it owns
 * a terminal and a clock.
 */

const FRAME_BUDGET_MS = 8;

/** The mount key an app's `root` option is opened under. */
const ROOT_KEY = 'root';
const SCREEN_KEY = 'screen';

/** Render/layout passes per frame. Measurement needs a second one. */
const MAX_LAYOUT_PASSES = 3;

export class App implements TextUIApp {
  readonly store: ReturnType<typeof createStore>;
  readonly events: ReturnType<typeof createEvents>;
  readonly when: ReturnType<typeof createWhen>;
  readonly components: ReturnType<typeof createComponents>;
  readonly themes: ReturnType<typeof createThemes>;
  readonly services: ReturnType<typeof createServices>;
  readonly i18n: ReturnType<typeof createI18n>;
  readonly layouts: ReturnType<typeof createLayouts>;
  readonly shells: ReturnType<typeof createShells>;
  readonly animation: ReturnType<typeof createAnimation>;
  readonly focus: ReturnType<typeof createFocus>;
  readonly layers: ReturnType<typeof createLayers>;
  readonly commands: ReturnType<typeof createCommands>;
  readonly keybindings: ReturnType<typeof createKeybindings>;
  readonly resources: ReturnType<typeof createResources>;
  readonly syntax: ReturnType<typeof createSyntax>;
  readonly surfaces: ReturnType<typeof createSurfaces>;
  readonly screens: ReturnType<typeof createNavigation>;
  readonly manifest: ReturnType<typeof createManifests>;
  readonly terminal: NonNullable<CreateAppOptions['terminal']>;

  private buffer_: Buffer;
  /** The mount holding the top of the screen stack, while there is one. */
  private screenMount: Disposable | null = null;
  private root: Instance | null = null;
  private frameScheduled = false;
  private frameTimer: ReturnType<typeof setTimeout> | null = null;
  private running_ = false;
  private disposed = false;
  private themeId: string;
  private shellId: string;
  private resolvedTheme: ResolvedTheme;
  private bag = createBag();
  private hovered: string | null = null;
  /** Focus registrations created from `focusable` props, by focus id. */
  private declaredFocus = new Map<string, { instanceId: string; dispose(): void }>();
  private lastFrame: Frame | null = null;
  private renderCount = 0;

  private runtime: Runtime;

  constructor(private options: CreateAppOptions = {}) {
    // Construction order is dependency order, and the comment is here because
    // reordering these lines silently breaks the app rather than failing to
    // compile: several of them capture `this` in closures.
    this.store = createStore();
    this.events = createEvents();
    this.when = createWhen(this.store);
    this.components = createComponents();
    this.themes = createThemes(options.themes);
    this.services = createServices();
    this.i18n = createI18n(options.locale ?? 'en');
    this.layouts = createLayouts();
    this.shells = createShells();

    this.animation = createAnimation({
      enabled: options.animations ?? true,
      maxFps: options.maxFps ?? 30,
    });

    // Focus is published, not just held. A pane that wants to say "you are in
    // here" would otherwise have to become a focusable itself just to be told
    // when focus moved - which costs a tab stop for something that is not a
    // control, and makes tabbing into a pane take two presses.
    this.focus = createFocus(() => {
      const id = this.focus.focused();
      this.store.set('$/focus/id' as BindingPath, id);
      this.store.set('$/focus/scope' as BindingPath, id ? this.focus.scopeOf(id) : null);
      this.requestRender();
    });
    this.layers = createLayers(() => this.requestRender());

    this.commands = createCommands({
      store: this.store,
      when: this.when,
      app: () => this,
      onError: (err, ctx) => this.handleError(err, ctx),
    });

    this.keybindings = createKeybindings({
      when: this.when,
      commands: this.commands,
      activeScopes: () => this.focus.chain(),
      onError: (err, ctx) => this.handleError(err, ctx),
    });

    this.resources = createResources({ components: this.components, when: this.when });

    this.syntax = createSyntax({
      kindMatches: (kind, ancestor) => this.resources.kindMatches(kind, ancestor),
      onError: (err, ctx) => this.handleError(err, ctx),
    });

    this.surfaces = createSurfaces({
      store: this.store,
      when: this.when,
      resources: () => this.resources,
      onChange: () => this.requestRender(),
    });

    this.screens = createNavigation({
      store: this.store,
      focus: this.focus,
      onChange: () => this.requestRender(),
      mount: (entry) => this.mountScreen(entry),
    });

    this.manifest = createManifests(this);

    if (!options.terminal) this.requireTerminal();
    this.terminal = options.terminal;

    this.components.registerMany(PRIMITIVES);
    // Registered here rather than by `registerBuiltins`, because an
    // application that never registers the catalog can still navigate.
    this.components.registerMany(SCREEN_COMPONENTS);

    this.themeId = options.theme ?? 'dark';
    this.shellId = options.shell ?? 'plain';

    const size = this.terminal.size();
    this.buffer_ = new Buffer(size.width, size.height);
    this.resolvedTheme = this.themes.resolve(this.themeId, this.terminal.capabilities());

    this.store.onError = (err, ctx) => this.handleError(err, ctx);
    this.events.onError = (err, ctx) => this.handleError(err, ctx);

    this.publishEnvironment();

    this.runtime = {
      store: this.store,
      events: this.events,
      when: this.when,
      components: this.components,
      services: this.services,
      focus: this.focus,
      layers: this.layers,
      animation: this.animation,
      i18n: this.i18n,
      theme: () => this.resolvedTheme,
      capabilities: () => this.terminal.capabilities(),
      size: () => this.terminal.size(),
      execute: (id, args) => this.commands.execute(id, args),
      emit: (path, payload) => this.events.emit(path as `@/${string}`, payload),
      requestRender: () => this.requestRender(),
      app: () => this,
      onError: (err, ctx) => this.handleError(err, ctx),
    };
  }

  private requireTerminal(): never {
    throw new Error(
      '[textui] createApp needs a terminal adapter - pass one from @textui/terminal',
    );
  }

  // ------------------------------------------------------------ environment

  get capabilities(): TerminalCapabilities {
    return this.terminal.capabilities();
  }

  get theme(): ResolvedTheme {
    return this.resolvedTheme;
  }

  get size(): Size {
    return this.terminal.size();
  }

  get running(): boolean {
    return this.running_;
  }

  private publishEnvironment(): void {
    const size = this.terminal.size();
    this.store.batch(() => {
      this.store.set('$/modus/size', size);
      this.store.set('$/modus/capabilities', this.terminal.capabilities());
      this.store.set('$/modus/theme', this.themeId);
      this.store.set('$/modus/locale', this.i18n.locale);
      this.store.set('$/layout/shell', this.shellId);
      // Named breakpoints, so a `when` clause reads well.
      this.store.set('$/modus/class', size.width < 60 ? 'narrow' : size.width < 100 ? 'medium' : 'wide');
    });
  }

  setTheme(id: string): void {
    if (!this.themes.get(id)) {
      throw new Error(`[textui] no theme registered as "${id}"`);
    }
    this.themeId = id;
    this.resolvedTheme = this.themes.resolve(id, this.terminal.capabilities());
    this.store.set('$/modus/theme', id);
    this.buffer_.invalidate();
    this.requestRender(true);
  }

  setShell(id: string): void {
    if (!this.shells.get(id)) {
      throw new Error(`[textui] no shell registered as "${id}"`);
    }
    this.shellId = id;
    this.store.set('$/layout/shell', id);
    const shell = this.shells.get(id);
    if (shell?.theme && this.themes.get(shell.theme)) this.setTheme(shell.theme);
    this.buffer_.invalidate();
    this.requestRender(true);
  }

  activeShell(): string {
    return this.shellId;
  }

  setCapabilityOverrides(overrides: CapabilityOverrides): void {
    this.terminal.setCapabilityOverrides(overrides);
    this.resolvedTheme = this.themes.resolve(this.themeId, this.terminal.capabilities());
    this.publishEnvironment();
    this.buffer_.invalidate();
    this.requestRender(true);
  }

  // ------------------------------------------------------------- lifecycle

  async start(): Promise<void> {
    if (this.running_) return;

    await this.options.onBoot?.(this);
    await this.store.hydrate();

    // `root` is a mount like any other, so the shell arranges it, the layouts
    // apply to it, and everything that reads the surface registry sees it.
    if (this.options.root && this.shells.get(this.shellId)) {
      this.surfaces.open({ surface: 'main', key: ROOT_KEY, target: this.options.root });
    }

    // A shell may prefer a theme it was designed against. An explicit theme in
    // the options always wins - the shell only fills in a default.
    if (!this.options.theme) {
      const shellTheme = this.shells.get(this.shellId)?.theme;
      if (shellTheme && this.themes.get(shellTheme)) this.setTheme(shellTheme);
    }

    const caps = this.terminal.capabilities();
    await this.terminal.acquire({
      managed: true,
      altScreen: true,
      hideCursor: true,
      paste: caps.paste,
      mouse: caps.mouse,
      wheel: caps.wheel,
      focusEvents: caps.focusEvents,
      enhancedKeys: caps.kittyKeyboard,
      ...this.options.session,
    });

    this.bag.add(this.terminal.onInput((event) => this.handleInput(event)));
    this.bag.add(this.terminal.onResize((size) => this.handleResize(size)));

    this.running_ = true;
    this.publishEnvironment();
    this.renderFrame();
  }

  async stop(): Promise<void> {
    if (!this.running_) return;
    this.running_ = false;

    if (this.frameTimer) clearTimeout(this.frameTimer);
    this.frameTimer = null;
    this.frameScheduled = false;

    this.bag.dispose();
    this.bag = createBag();

    for (const entry of this.declaredFocus.values()) entry.dispose();
    this.declaredFocus.clear();

    if (this.root) {
      disposeTree(this.root);
      this.root = null;
    }

    for (const scope of this.options.clearOnStop ?? []) this.store.clearScope(scope);

    await this.terminal.release();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    void this.stop();
    this.animation.dispose();
    this.layers.dispose();
    this.events.dispose();
    this.store.dispose();
    this.terminal.dispose();
  }

  // ---------------------------------------------------------------- frames

  private requestRender(force = false): void {
    if (force && this.root) {
      walkInstances(this.root, (i) => {
        i.dirty = true;
        i.childDirty = true;
      });
    }
    if (!this.running_ || this.frameScheduled) return;
    this.frameScheduled = true;

    // Coalesce a burst of state changes into one frame, and never render
    // faster than the animation driver's ceiling.
    const delay = Math.max(0, Math.floor(1000 / Math.max(1, this.animation.maxFps)) - FRAME_BUDGET_MS);
    this.frameTimer = setTimeout(() => {
      this.frameTimer = null;
      this.frameScheduled = false;
      this.renderFrame();
    }, delay);
    this.frameTimer.unref?.();
  }

  flush(): void {
    if (this.frameTimer) {
      clearTimeout(this.frameTimer);
      this.frameTimer = null;
    }
    this.frameScheduled = false;
    this.renderFrame();
  }

  /**
   * The tree the frame renders: the shell, always, when one is registered.
   *
   * `root` is an alternative to *screens*, not to the shell - it is mounted
   * into `main` at boot. Returning it here instead meant an application built
   * that way had no shell at all: no canvas background (so a light theme left
   * the terminal's own dark one behind and only dialogs looked light), no
   * status surface, no toast host, and `setShell` did nothing.
   */
  /**
   * Put the current screen into its surface.
   *
   * A screen is a mount like `root` is a mount: the shell arranges it, the
   * layouts apply to it, and anything reading the surface registry sees it.
   * Only the top of the stack is mounted - what a screen underneath keeps is
   * its store scope, if it asked to, and not its instances.
   *
   * Parameters arrive as props. A screen that wants them deeper than its own
   * signature reads `$/layout/screen/params` instead of forwarding them.
   */
  private mountScreen(entry: ScreenEntry | null): void {
    this.screenMount?.dispose();
    this.screenMount = null;
    if (!entry) return;

    const def = this.screens.get(entry.id);
    if (!def) return;

    const node: ComponentNode = typeof def.component === 'string'
      ? { component: def.component, ...(entry.params ?? {}) }
      : { ...def.component, ...(entry.params ?? {}) };

    this.screenMount = this.surfaces.open({
      surface: def.surface ?? 'main',
      key: `${SCREEN_KEY}:${entry.id}`,
      target: { component: 'Screen', screenId: entry.id, children: [node] },
      ...(def.display ? { display: def.display } : {}),
    });
  }

  private rootNode(): ComponentNode {
    const shell = this.shells.get(this.shellId);
    if (shell) return { component: shell.component };

    // No shell registered at all: draw `root` on a themed canvas, so an
    // application that registers nothing but primitives still works.
    if (this.options.root) {
      return {
        component: 'box',
        width: '100%',
        height: '100%',
        direction: 'column',
        bg: 'canvas',
        children: this.options.root,
      };
    }

    return {
      component: 'text',
      content: `[textui] no shell registered as "${this.shellId}"`,
      fg: 'danger',
    };
  }

  /**
   * Layers are composed at the root rather than inside the tree, so an overlay
   * is never clipped by whatever opened it.
   */
  /**
   * The root node: the shell, plus whatever is on the layers above it.
   *
   * The wrapper is unconditional, and that matters more than it looks. If the
   * root were the bare shell whenever no layer is open, then opening the first
   * toast would change the root's component - and a changed root is a full
   * unmount and remount, so every screen would lose its state the moment
   * anything notified it of anything. One shape, always.
   */
  private composeRoot(): ComponentNode {
    const entries = this.layers.entries().filter((e) => e.layer !== 'base');
    const base = this.rootNode();

    const children: ComponentNode[] = [
      { component: 'box', key: '__base__', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, children: base },
    ];

    const scrim = entries.find((e) => e.scrim);
    if (scrim) {
      children.push({
        component: 'box',
        key: '__scrim__',
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        // Washed, not covered: the screen behind a modal recedes and stays
        // readable, instead of becoming a rectangle of nothing.
        scrim: true,
        zIndex: 50,
      });
    }

    for (const entry of entries) children.push(this.layerNode(entry));

    return {
      component: 'box',
      key: '__root__',
      width: '100%',
      height: '100%',
      children,
    };
  }

  private layerNode(entry: LayerEntry): ComponentNode {
    const size = this.terminal.size();
    const position = entry.position ?? { kind: 'center' };
    const zIndex = entry.layer === 'notification' ? 200 : entry.layer === 'modal' ? 100 : 60;

    // Every layer gets a focus scope, so `trapFocus` is a fact rather than a
    // flag. Without it a layer assembled from plain nodes cannot trap, and tab
    // leaves the open thing on the first press.
    const scoped: ComponentNode = {
      component: 'LayerScope',
      scopeId: entry.id,
      trap: entry.trapFocus === true,
      children: entry.node,
    };

    const wrap = (style: Record<string, unknown>): ComponentNode => ({
      component: 'box',
      key: entry.id,
      position: 'absolute',
      zIndex,
      children: scoped,
      ...style,
    });

    switch (position.kind) {
      case 'center':
        // Centring without knowing the child's size means centring the band it
        // sits in and letting the child align itself inside.
        return wrap({
          top: 0, left: 0, right: 0, bottom: 0,
          align: 'center', justify: 'center',
        });

      case 'screen':
        return wrap({
          top: position.rect.y ?? 0,
          left: position.rect.x ?? 0,
          ...(position.rect.width !== undefined ? { width: position.rect.width } : {}),
          ...(position.rect.height !== undefined ? { height: position.rect.height } : {}),
        });

      case 'point':
        return wrap({ top: position.y, left: position.x });

      case 'anchor': {
        const rect = this.rectOf(position.targetId);
        if (!rect) return wrap({ top: 0, left: 0 });
        const offset = position.offset ?? 0;
        const align = position.align ?? 'start';

        if (position.side === 'bottom') {
          return wrap({ top: rect.y + rect.height + offset, left: alignX(rect, align) });
        }
        if (position.side === 'top') {
          return wrap({ bottom: Math.max(0, size.height - rect.y + offset), left: alignX(rect, align) });
        }
        if (position.side === 'right') {
          return wrap({ top: rect.y, left: rect.x + rect.width + offset });
        }
        return wrap({ top: rect.y, right: Math.max(0, size.width - rect.x + offset) });
      }

      default:
        return wrap({ top: 0, left: 0 });
    }
  }

  private rectOf(focusId: string): Rect | null {
    const order = this.focus.order();
    if (!order.includes(focusId) && this.focus.focused() !== focusId) {
      // The target may be non-tabbable but still registered.
    }
    let found: Rect | null = null;
    if (this.root) {
      walkInstances(this.root, (instance) => {
        if (found) return;
        if (instance.props.id === focusId && instance.box) found = instance.box.rect;
      });
    }
    return found;
  }

  private stateOf(instance: Instance): InteractionState {
    const id = typeof instance.props.id === 'string' ? instance.props.id : instance.id;
    const focusedId = this.focus.focused();
    return {
      focused: focusedId === id || focusedId === `${instance.id}:focus`,
      hovered: this.hovered === id,
      active: false,
      selected: instance.props.selected === true,
      disabled: instance.props.disabled === true,
    };
  }

  private renderFrame(): void {
    if (!this.running_ || this.disposed) return;

    const size = this.terminal.size();
    if (size.width !== this.buffer_.width || size.height !== this.buffer_.height) {
      this.buffer_.resize(size.width, size.height);
    }

    const env: PaintEnv = {
      theme: this.resolvedTheme,
      capabilities: this.terminal.capabilities(),
      stateOf: (instance) => this.stateOf(instance),
    };

    const node = this.composeRoot();
    const viewport = { x: 0, y: 0, width: size.width, height: size.height };

    // Render, lay out, and hand every measured component its rect, then do it
    // again if anything changed as a result. Two things change: a component
    // that sized itself from its new rect, and an effect that ran during the
    // pass - `autoFocus` is the one that shows, because painting before it
    // lands means one frame of a dialog whose default button is not lit.
    //
    // Twice is the steady state; the bound is there for the pathological case
    // where two of them chase each other.
    for (let pass = 0; pass < MAX_LAYOUT_PASSES; pass++) {
      try {
        this.root = renderTree(this.runtime, this.root, node, {
          diagnostics: this.options.diagnostics,
        });
      } catch (err) {
        this.handleError(err, 'render');
        return;
      }

      const effects = collectEffects(this.root);
      for (const effect of effects) effect();

      const boxes = buildBoxes(this.root, env);
      const rootBox: LayoutBox = {
        style: { direction: 'column' },
        borderEdges: ZERO_EDGES,
        children: boxes,
        rect: { ...viewport },
        content: { ...viewport },
      };
      layout(rootBox, viewport);

      const remeasured = flushMeasures();
      if (!remeasured && !this.isDirty()) break;
    }
    if (!this.root) return;

    this.syncDeclaredFocusables();
    this.updateFocusRects();

    // Once. There were two, the first blanking to palette 0 and the second to
    // the default background over the top of it - a whole extra pass over
    // every cell on screen, every frame, with nothing to show for it.
    this.buffer_.clear();
    paintTree(this.buffer_, this.root, env, viewport);

    const frame = diffFrame(this.buffer_, this.cursorPosition());
    this.buffer_.commit();
    this.lastFrame = frame;
    this.renderCount++;

    this.emitFrame(frame);

    // An effect may have marked something dirty; give it the next frame.
    if (this.isDirty()) this.requestRender();
  }

  /** Overridden by the test harness, which has no bytes to write. */
  protected emitFrame(frame: Frame): void {
    const writer = this.services.get(WRITER_KEY);
    if (!writer) return;
    const data = writer.write(frame);
    if (data !== '') {
      this.terminal.write(data);
      void this.terminal.flush();
    }
  }

  private cursorPosition(): { x: number; y: number; visible: boolean } | null {
    const focused = this.focus.focused();
    if (!focused || !this.root) return null;

    let position: { x: number; y: number; visible: boolean } | null = null;
    walkInstances(this.root, (instance) => {
      if (position) return;
      const cursor = instance.props.cursor;
      if (!cursor || !instance.box) return;
      const id = typeof instance.props.id === 'string' ? instance.props.id : instance.id;
      if (id !== focused && `${instance.id}:focus` !== focused) return;

      const offset = typeof cursor === 'number' ? cursor : 0;
      position = {
        x: instance.box.content.x + offset,
        y: instance.box.content.y,
        visible: true,
      };
    });
    return position;
  }

  /**
   * `focusable` and `onKey` are props on every node, so a plain `box` can take
   * focus without a hook. Those declarations are reconciled here rather than
   * during render, because a node that has gone away must lose its
   * registration - and only the render pass knows which are still mounted.
   */
  private syncDeclaredFocusables(): void {
    if (!this.root) return;
    const seen = new Set<string>();

    walkInstances(this.root, (instance) => {
      if (instance.props.focusable !== true) return;
      const id = typeof instance.props.id === 'string' ? instance.props.id : instance.id;
      seen.add(id);

      const onKey = typeof instance.props.onKey === 'function'
        ? (instance.props.onKey as (event: KeyEvent) => boolean | void)
        : undefined;
      const options = {
        id,
        disabled: instance.props.disabled === true,
        skipTab: instance.props.skipTab === true,
        global: instance.props.global === true,
        order: typeof instance.props.order === 'number' ? instance.props.order : undefined,
        scopeId: typeof instance.props.focusScope === 'string'
          ? instance.props.focusScope
          : focusScopeOf(instance),
        onKey,
        rect: instance.box?.rect,
      };

      const existing = this.declaredFocus.get(id);
      if (existing && existing.instanceId === instance.id) {
        this.focus.update(id, options);
        return;
      }

      // A hook already owns this id: `useFocus` registered it and `useInput`
      // put a handler on it. Registering over the top would replace that
      // handler with this node's - usually with nothing - and the control
      // would keep its focus ring while silently ignoring every key.
      if (!existing && this.focus.has(id)) {
        const { onKey: _declared, ...rest } = options;
        this.focus.update(id, onKey ? { ...rest, onKey } : rest);
        return;
      }

      existing?.dispose();
      this.declaredFocus.set(id, {
        instanceId: instance.id,
        dispose: this.focus.register(options).dispose,
      });

      if (instance.props.autoFocus === true && this.focus.focused() === null) {
        this.focus.focus(id);
      }
    });

    for (const [id, entry] of this.declaredFocus) {
      if (seen.has(id)) continue;
      entry.dispose();
      this.declaredFocus.delete(id);
    }
  }

  private updateFocusRects(): void {
    if (!this.root) return;
    walkInstances(this.root, (instance) => {
      if (!instance.box) return;
      const id = typeof instance.props.id === 'string' ? instance.props.id : null;
      if (id) this.focus.setRect(id, instance.box.rect);
      this.focus.setRect(`${instance.id}:focus`, instance.box.rect);
    });
  }

  private isDirty(): boolean {
    const root = this.root;
    return root ? root.dirty || root.childDirty : false;
  }

  buffer(): Buffer {
    return this.buffer_;
  }

  frame(): Frame | null {
    return this.lastFrame;
  }

  // ----------------------------------------------------------------- input

  /**
   * Input is processed one event at a time, and the tree is re-rendered
   * between events rather than once at the end of the batch.
   *
   * This matters more than it looks. A terminal delivers several keystrokes in
   * a single read, and a handler closes over the props from its last render -
   * so without settling in between, typing "ab" quickly makes the handler for
   * "b" see the state from before "a", and the character is lost. Rendering
   * per key is what every terminal application does, and the frame diff makes
   * it cheap.
   */
  handleInput(event: InputEvent): void {
    // A handler that throws must not take the process with it. The screen is
    // the output, so an uncaught error from a keystroke exits to a shell with
    // a stack trace and no application - which is a worse answer than any
    // wrong frame. It goes in the diagnostics like every other error.
    try {
      this.dispatchInput(event);
    } catch (err) {
      this.handleError(err, `input:${event.type}`);
    }
    if (this.running_ && this.isDirty()) this.renderFrame();
  }

  private dispatchInput(event: InputEvent): void {
    switch (event.type) {
      case 'key':
        this.handleKey(event);
        break;
      case 'mouse':
        this.handleMouse(event);
        break;
      case 'paste':
        this.events.emit('@/input/paste', event.text);
        this.focus.dispatch({
          type: 'key', name: 'paste', char: event.text, raw: event.text,
          ctrl: false, alt: false, shift: false, meta: false, handled: false,
        });
        break;
      case 'terminal-focus':
        this.store.set('$/modus/focused', event.focused);
        break;
      case 'resize':
        this.handleResize({ width: event.width, height: event.height });
        break;
    }
  }

  /**
   * Order matters. A focused text field must see a plain character before any
   * keybinding does, or typing "q" in a search box quits the application. So
   * the focused node gets first refusal, then chords, then global handlers.
   */
  private handleKey(event: KeyEvent): void {
    /*
     * Every key, before anything decides what to do with it.
     *
     * "My binding does not fire" has two very different answers - the key
     * never arrived, or something upstream took it - and from inside a
     * full-screen application they look identical. A terminal that keeps
     * `ctrl+s` for flow control, or an editor hosting the terminal that keeps
     * it for itself, is invisible until the log can be asked whether the key
     * was ever seen. `@/input/paste` was already here; this is the other half.
     */
    this.events.emit('@/input/key', {
      name: event.name,
      ...(event.ctrl ? { ctrl: true } : {}),
      ...(event.alt ? { alt: true } : {}),
      ...(event.shift ? { shift: true } : {}),
      ...(event.meta ? { meta: true } : {}),
    });

    const focusedNode = this.focus.focused();

    if (focusedNode && this.focus.dispatch(event)) {
      this.requestRender();
      return;
    }

    if (this.keybindings.handle(event) !== 'unhandled') {
      this.requestRender();
      return;
    }

    // Escape closes the topmost dismissible layer, when nothing else took it.
    if (event.name === 'escape') {
      const top = this.layers.topmostDismissible();
      if (top) {
        this.layers.close(top.id, 'escape');
        return;
      }
    }

    if (event.name === 'tab') {
      this.focus.move(event.shift ? 'previous' : 'next');
      return;
    }

    if (!focusedNode && this.focus.dispatch(event)) this.requestRender();
  }

  private handleMouse(event: MouseEvent): void {
    const hit = this.focus.at(event.x, event.y);

    if (event.action === 'move') {
      if (hit !== this.hovered) {
        this.hovered = hit;
        this.requestRender();
      }
      return;
    }

    if (event.action === 'down' && hit) this.focus.focus(hit);

    if (this.root) {
      this.dispatchMouse(this.root, event);
    }
    this.requestRender();
  }

  /** Innermost box under the pointer first, then outward. */
  private dispatchMouse(instance: Instance, event: MouseEvent): boolean {
    for (let i = instance.children.length - 1; i >= 0; i--) {
      const child = instance.children[i] as Instance;
      if (this.dispatchMouse(child, event)) return true;
    }

    const box = instance.box;
    if (!box) return false;
    const { x, y, width, height } = box.rect;
    if (event.x < x || event.x >= x + width || event.y < y || event.y >= y + height) return false;

    const onMouse = instance.props.onMouse;
    if (typeof onMouse === 'function' && (onMouse as (e: MouseEvent) => boolean | void)(event) === true) {
      return true;
    }

    if (event.action === 'down' && event.button === 'left') {
      const onClick = instance.props.onClick;
      if (typeof onClick === 'function') {
        (onClick as (e: MouseEvent) => void)(event);
        return true;
      }
    }
    return false;
  }

  private handleResize(size: Size): void {
    this.buffer_.resize(size.width, size.height);
    this.buffer_.invalidate();
    this.publishEnvironment();
    this.requestRender(true);
  }

  // ------------------------------------------------------------- shortcuts

  open: TextUIApp['open'] = (mount) => this.surfaces.open(mount);
  openResource: TextUIApp['openResource'] = (uri, options) =>
    this.surfaces.openResource(uri, options);
  /**
   * Fan an adapter out across the registries it touches, and hand back one
   * disposable for the lot. Order matters: kinds first, so a viewer registered
   * for `file.data.json` has something to match before anything is classified.
   */
  registerAdapter(adapter: ResourceAdapter): Disposable {
    const bag = createBag();

    for (const kind of adapter.kinds ?? []) bag.add(this.resources.registerKind(kind));
    for (const provider of adapter.providers ?? []) bag.add(this.resources.registerProvider(provider));
    for (const component of adapter.components ?? []) bag.add(this.components.register(component));
    for (const highlighter of adapter.highlighters ?? []) bag.add(this.syntax.register(highlighter));
    for (const viewer of adapter.viewers ?? []) bag.add(this.resources.registerViewer(viewer));
    for (const editor of adapter.editors ?? []) bag.add(this.resources.registerEditor(editor));
    for (const action of adapter.actions ?? []) bag.add(this.resources.registerAction(action));
    for (const command of adapter.commands ?? []) bag.add(this.commands.register(command));
    for (const binding of adapter.keybindings ?? []) bag.add(this.keybindings.register(binding));

    const extra = adapter.register?.(this);
    if (extra) bag.add(extra);

    this.bag.add(bag);
    return bag;
  }

  execute: TextUIApp['execute'] = (id, args, source) =>
    this.commands.execute(id, args, source);

  // ------------------------------------------------------------- inspector

  inspect(): InspectorNode | null {
    if (!this.root) return null;
    return describe(this.root, this.focus.focused());
  }

  stats(): { renders: number; runs: number; instances: number } {
    let instances = 0;
    if (this.root) walkInstances(this.root, () => { instances++; });
    return {
      renders: this.renderCount,
      runs: this.lastFrame?.runs.length ?? 0,
      instances,
    };
  }

  private handleError(err: unknown, context: string): void {
    const message = err instanceof Error ? err.stack ?? err.message : String(err);
    this.store.collection('$/modus/diagnostics/errors').append({
      context,
      message,
      at: Date.now(),
    });
    this.store.collection('$/modus/diagnostics/errors').cap(50);
    if (!this.options.diagnostics) {
      console.error(`[textui] ${context}`, err);
    }
  }
}

function alignX(rect: Rect, align: 'start' | 'center' | 'end'): number {
  if (align === 'center') return rect.x + Math.floor(rect.width / 2);
  if (align === 'end') return rect.x + rect.width;
  return rect.x;
}

function describe(instance: Instance, focused: string | null): InspectorNode {
  const props: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(instance.props)) {
    if (k === 'children') continue;
    props[k] = typeof v === 'function' ? '[function]' : v;
  }

  const id = typeof instance.props.id === 'string' ? instance.props.id : instance.id;
  const content = instance.props.content;

  return {
    id: instance.id,
    component: instance.component,
    key: instance.key,
    rect: instance.box?.rect,
    props,
    role: typeof instance.props.role === 'string' ? instance.props.role : undefined,
    label: typeof instance.props.label === 'string' ? instance.props.label : undefined,
    text: typeof content === 'string' ? content : undefined,
    focusable: instance.props.focusable === true,
    focused: focused === id || focused === `${instance.id}:focus`,
    renderReason: instance.renderReason,
    bindings: instance.reads.size > 0 ? [...instance.reads] : undefined,
    children: instance.children.map((child) => describe(child, focused)),
  };
}

/**
 * The frame writer is a service rather than an import, so core never depends
 * on terminal encoding - the test harness and the static renderer simply do
 * not provide one.
 */
export interface FrameWriter {
  write(frame: Frame): string;
  invalidate(): void;
}

export const WRITER_KEY = serviceKey<FrameWriter>('textui.writer');

export function createApp(options: CreateAppOptions = {}): App {
  return new App(options);
}
