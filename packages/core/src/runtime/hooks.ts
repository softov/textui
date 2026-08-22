import type { BindingPath, EventPath } from '../types/graph.js';
import type { Disposable } from '../types/disposable.js';
import type { ResolvedTheme } from '../types/theme.js';
import type { TerminalCapabilities } from '../types/capabilities.js';
import type { Rect, Size } from '../types/geometry.js';
import type { ServiceKey } from '../types/services.js';
import type { KeyEvent } from '../types/input.js';
import type { CommandDefinition } from '../types/command.js';
import type { FocusDirection } from '../types/focus.js';
import type { TaskFn, TaskState } from '../types/async.js';
import type { Stream, StreamSource } from '../types/stream.js';
import type { TextUIApp } from '../types/app.js';
import type { I18n } from '../types/i18n.js';
import type { Navigator } from '../types/navigation.js';
import type { Resource } from '../types/resource.js';
import type { SyntaxQuery, SyntaxRegistry, SyntaxToken } from '../types/syntax.js';
import type { RenderOutput } from '../types/render.js';
import type { Instance } from './instance.js';
import type { LayoutBox } from '../render/layout.js';
import { overflowOn } from '../render/layout.js';
import type { Runtime } from './runtime.js';
import { markDirty, readContext } from './instance.js';
import { resolvePath } from '../util/paths.js';
import { toStream } from '../util/stream.js';
import { GLOBAL_SCOPE } from '../core/focus.js';
import { plainTokens } from '../core/syntax.js';
import { CLIPBOARD_PATH, readClipboard, writeClipboard } from '../core/clipboard.js';

/**
 * Hooks.
 *
 * The rules are React's, and for the same reason: slots are matched by call
 * order, so a hook behind a condition breaks the instance it lives in. What is
 * different is what they reach - the store, the focus manager, the command
 * registry - because those, not component state, are where a terminal
 * application actually keeps things.
 */

let current: Instance | null = null;

export function setCurrentInstance(instance: Instance | null): void {
  current = instance;
  if (instance) instance.hookIndex = 0;
}

export function currentInstance(): Instance {
  if (!current) {
    throw new Error('[textui] a hook was called outside a component render');
  }
  return current;
}

export function useRuntime(): Runtime {
  return currentInstance().runtime;
}

function slot<T>(kind: string, init: () => T): { value: T; write(v: T): void; instance: Instance; index: number } {
  const instance = currentInstance();
  const index = instance.hookIndex++;
  let entry = instance.hooks[index];

  if (!entry) {
    entry = { kind, value: init() };
    instance.hooks[index] = entry;
  } else if (entry.kind !== kind) {
    throw new Error(
      `[textui] hook order changed in <${instance.component}>: slot ${index} was ` +
      `${entry.kind}, now ${kind}. A hook behind a condition does this.`,
    );
  }

  return {
    value: entry.value as T,
    write(v: T) {
      (instance.hooks[index] as { value: unknown }).value = v;
    },
    instance,
    index,
  };
}

function invalidate(instance: Instance, reason: string): void {
  markDirty(instance, reason);
  instance.runtime.requestRender();
}

// ------------------------------------------------------------------ state

export type SetState<T> = (next: T | ((prev: T) => T)) => void;

export function useState<T>(initial: T | (() => T)): [T, SetState<T>] {
  const s = slot<{ value: T }>('state', () => ({
    value: typeof initial === 'function' ? (initial as () => T)() : initial,
  }));
  const { instance } = s;

  const set: SetState<T> = (next) => {
    const box = s.value;
    const value = typeof next === 'function' ? (next as (prev: T) => T)(box.value) : next;
    if (Object.is(value, box.value)) return;
    box.value = value;
    invalidate(instance, 'useState');
  };

  return [s.value.value, set];
}

export function useReducer<S, A>(
  reducer: (state: S, action: A) => S,
  initial: S,
): [S, (action: A) => void] {
  const [state, setState] = useState<S>(initial);
  return [state, (action: A) => setState((prev) => reducer(prev, action))];
}

export function useRef<T>(initial: T): { current: T } {
  return slot<{ current: T }>('ref', () => ({ current: initial })).value;
}

function depsChanged(prev: unknown[] | undefined, next: unknown[] | undefined): boolean {
  if (!prev || !next) return true;
  if (prev.length !== next.length) return true;
  for (let i = 0; i < prev.length; i++) {
    if (!Object.is(prev[i], next[i])) return true;
  }
  return false;
}

export function useMemo<T>(factory: () => T, deps: unknown[]): T {
  const instance = currentInstance();
  const index = instance.hookIndex++;
  const entry = instance.hooks[index];

  if (!entry || entry.kind !== 'memo' || depsChanged(entry.deps, deps)) {
    instance.hooks[index] = { kind: 'memo', value: factory(), deps: [...deps] };
  }
  return (instance.hooks[index] as { value: T }).value;
}

export function useCallback<T extends (...args: never[]) => unknown>(fn: T, deps: unknown[]): T {
  return useMemo(() => fn, deps);
}

/**
 * Runs after the frame is painted. The returned function runs before the next
 * run and on unmount - so a subscription set up here is torn down exactly once.
 */
export function useEffect(effect: () => void | (() => void), deps?: unknown[]): void {
  const instance = currentInstance();
  const index = instance.hookIndex++;
  const entry = instance.hooks[index];
  const changed = !entry || entry.kind !== 'effect' || deps === undefined || depsChanged(entry.deps, deps);

  if (!changed) return;

  const previousCleanup = entry?.kind === 'effect' ? entry.cleanup : undefined;
  instance.hooks[index] = { kind: 'effect', value: undefined, deps: deps ? [...deps] : undefined };

  instance.pendingEffects.push(() => {
    if (typeof previousCleanup === 'function') {
      try {
        previousCleanup();
      } catch (err) {
        instance.runtime.onError(err, `effect cleanup in <${instance.component}>`);
      }
    }
    try {
      const cleanup = effect();
      (instance.hooks[index] as { cleanup?: (() => void) | void }).cleanup = cleanup;
    } catch (err) {
      instance.runtime.onError(err, `effect in <${instance.component}>`);
    }
  });
}

/** Same contract as `useEffect`, but flushed before the frame is painted. */
export function useLayoutEffect(effect: () => void | (() => void), deps?: unknown[]): void {
  useEffect(effect, deps);
}

// ---------------------------------------------------------------- context

export interface Context<T> {
  id: string;
  defaultValue: T;
  Provider: (props: { value: T; children?: unknown }) => RenderOutput;
}

let contextCounter = 0;

export function createContext<T>(name: string, defaultValue: T): Context<T> {
  const id = `${name}#${++contextCounter}`;
  const ctx: Context<T> = {
    id,
    defaultValue,
    Provider: (props: { value: T; children?: unknown }): RenderOutput => {
      const instance = currentInstance();
      if (!instance.contexts) instance.contexts = new Map();
      instance.contexts.set(id, props.value);
      return props.children as RenderOutput;
    },
  };
  (ctx.Provider as { displayName?: string }).displayName = `${name}.Provider`;
  return ctx;
}

export function useContext<T>(context: Context<T>): T {
  const instance = currentInstance();
  const found = readContext(instance, context.id);
  return found === undefined ? context.defaultValue : (found as T);
}

// ------------------------------------------------------------------ store

/** Subscribe to a path and read it. Shared by the two store hooks. */
function useStorePath<T>(path: BindingPath): { absolute: BindingPath; value: T | undefined } {
  const instance = currentInstance();
  const runtime = instance.runtime;
  const absolute = resolvePath(path, instance.dataContext);

  useEffect(() => {
    const sub = runtime.store.subscribe(absolute, () => invalidate(instance, `store ${absolute}`));
    return () => sub.dispose();
  }, [absolute]);

  return { absolute, value: runtime.store.get<T>(absolute) };
}

/**
 * Store-backed state, in the shape of `useState`.
 *
 * The second argument is an initial value, and it behaves like one: if the
 * path is empty the first time a component asks for it, it is written. That is
 * what makes the hook safe to read like state - every other reader of the same
 * path sees the same thing, immediately, rather than each one privately
 * imagining its own default.
 *
 * The store stays authoritative. Copying a value out into `useState` and
 * editing the copy creates a second answer to a question the store already
 * answers; this hook is the way to avoid needing to.
 *
 * For a reader that must not write - a component displaying a path that
 * something else owns - use `useStoreValue`, whose second argument is a
 * display fallback and nothing more.
 */
export function useStore<T = unknown>(
  path: BindingPath,
  initial?: T,
): [T | undefined, (value: T) => void] {
  const instance = currentInstance();
  const runtime = instance.runtime;
  const { absolute, value } = useStorePath<T>(path);

  // Seeding during render rather than in an effect is deliberate: an effect
  // runs after the frame, so the first frame would paint the empty state and
  // every other reader would see a hole for one frame.
  if (initial !== undefined && value === undefined && !runtime.store.has(absolute)) {
    runtime.store.set(absolute, initial);
    return [initial, (next: T) => runtime.store.set(absolute, next)];
  }

  return [
    value === undefined ? initial : value,
    (next: T) => runtime.store.set(absolute, next),
  ];
}

/**
 * Read a store path without ever writing it.
 *
 * `fallback` is what this reader shows while the path is empty. It is not an
 * initial value and it is not shared: another component reading the same path
 * still sees nothing.
 */
export function useStoreValue<T = unknown>(path: BindingPath, fallback?: T): T | undefined {
  const { value } = useStorePath<T>(path);
  return value === undefined ? fallback : value;
}

/** Subscribe to a whole subtree - a namespace, a collection, a scope. */
export function useStoreSubtree<T = unknown>(path: BindingPath): T | undefined {
  const instance = currentInstance();
  const runtime = instance.runtime;
  const absolute = resolvePath(path, instance.dataContext);

  useEffect(() => {
    const sub = runtime.store.subscribe(
      absolute,
      () => invalidate(instance, `store subtree ${absolute}`),
      { subtree: true },
    );
    return () => sub.dispose();
  }, [absolute]);

  return runtime.store.get<T>(absolute);
}

export function useCollection<T = unknown>(path: BindingPath) {
  const instance = currentInstance();
  const absolute = resolvePath(path, instance.dataContext);
  useStoreValue(absolute);
  return instance.runtime.store.collection<T>(absolute);
}

// ----------------------------------------------------------------- events

export function useEvent(
  path: EventPath,
  handler: (payload: unknown) => void,
  options?: { subtree?: boolean },
): void {
  const runtime = useRuntime();
  const ref = useRef(handler);
  ref.current = handler;

  useEffect(() => {
    const sub = runtime.events.on(path, (payload) => ref.current(payload), options);
    return () => sub.dispose();
  }, [path, options?.subtree]);
}

export function useEmit(): (path: EventPath, payload?: unknown) => void {
  const runtime = useRuntime();
  return (path, payload) => runtime.events.emit(path, payload);
}

// -------------------------------------------------- environment and theme

export function useApp(): TextUIApp {
  const app = useRuntime().app();
  if (!app) {
    throw new Error('[textui] useApp() outside an application - use useRuntime() instead');
  }
  return app;
}

export function useTheme(): ResolvedTheme {
  return useRuntime().theme();
}

export function useCapabilities(): TerminalCapabilities {
  return useRuntime().capabilities();
}

/** Terminal size, re-rendering on resize. */
export function useSize(): Size {
  const instance = currentInstance();
  const runtime = instance.runtime;

  useEffect(() => {
    const sub = runtime.store.subscribe(
      '$/modus/size',
      () => invalidate(instance, 'resize'),
      { subtree: true },
    );
    return () => sub.dispose();
  }, []);

  return runtime.size();
}

/**
 * Adapt to the space this component was actually given, not to the terminal.
 * A sidebar and the main area are different widths on the same screen.
 */
/**
 * The content rect this component was last laid out into.
 *
 * A component that fills the space it is given cannot size itself from its
 * content - a file viewer that renders one row per line makes every pane
 * around it move when a different file is opened. Measuring inverts that: the
 * layout decides the size, and the component renders exactly what fits.
 *
 * The value is the previous frame's, and asking for it schedules another pass
 * when it changed, so the first frame after a resize is one frame behind and
 * every frame after it is exact.
 */
export function useMeasure(): Rect {
  const instance = currentInstance();
  measureWatchers.add(instance);
  return instance.measured ?? EMPTY_RECT;
}

/**
 * How big the content is, when it is bigger than the box holding it.
 *
 * `null` when everything fits. The layout has always recorded this - the
 * comment where it does says "so a scroll container knows how far it can go" -
 * but nothing read it, so no scroll container knew, and every one of them
 * scrolled for ever past its own last line.
 *
 * Reported for the nearest *scroll container* at or below this component's own
 * box - a viewport is a row holding the scrolling part beside a scrollbar, and
 * the row is not the part that scrolls.
 */
export function useScrollExtent(): Size | null {
  const instance = currentInstance();
  measureWatchers.add(instance);
  return instance.scrollExtent ?? null;
}

const EMPTY_RECT: Rect = { x: 0, y: 0, width: 0, height: 0 };

/** Instances that called `useMeasure`. Pruned as they unmount. */
const measureWatchers = new Set<Instance>();

function firstHostBox(instance: Instance): LayoutBox | undefined {
  if (instance.kind === 'host') return instance.box;
  for (const child of instance.children) {
    const found = firstHostBox(child);
    if (found) return found;
  }
  return undefined;
}

/**
 * The nearest box below this one that scrolls and has somewhere to scroll to.
 *
 * Not always the component's own first box: a viewport is usually a row
 * holding the scrolling part beside a scrollbar, and it is the part, not the
 * row, that overflows.
 *
 * It has to be a scroll container, not merely a box with more in it than fits.
 * The layout records an extent on anything that overflows, including a row of
 * text too wide for its pane - and a detail panel with one such row in it
 * reported that row's width as its own scroll extent, which is a number about
 * a different box on a different axis.
 */
function firstScrollingBox(box: LayoutBox | undefined): LayoutBox | undefined {
  if (!box) return undefined;
  if (overflowOn(box.style, 'y') === 'scroll' && box.scrollSize) return box;
  for (const child of box.children) {
    const found = firstScrollingBox(child);
    if (found) return found;
  }
  return undefined;
}

/**
 * Publish every watcher's laid-out rect. Returns true when one changed, which
 * means the frame is not final and the caller should render again.
 */
export function flushMeasures(): boolean {
  if (measureWatchers.size === 0) return false;

  let changed = false;
  for (const instance of measureWatchers) {
    if (!instance.mounted) {
      measureWatchers.delete(instance);
      continue;
    }
    const box = firstHostBox(instance);
    const rect = box?.content;
    if (!rect) continue;

    const extent = firstScrollingBox(box)?.scrollSize;
    const was = instance.scrollExtent;
    const extentSame = extent === undefined
      ? was === undefined
      : was !== undefined && was.width === extent.width && was.height === extent.height;

    const previous = instance.measured;
    if (
      extentSame &&
      previous &&
      previous.x === rect.x && previous.y === rect.y &&
      previous.width === rect.width && previous.height === rect.height
    ) {
      continue;
    }
    instance.measured = { ...rect };
    instance.scrollExtent = extent ? { ...extent } : undefined;
    markDirty(instance, 'useMeasure');
    changed = true;
  }
  return changed;
}

export function useBreakpoint(
  width: number,
  breakpoints: { compact?: number; minimal?: number } = {},
): 'full' | 'compact' | 'minimal' {
  const { compact = 60, minimal = 30 } = breakpoints;
  if (width < minimal) return 'minimal';
  if (width < compact) return 'compact';
  return 'full';
}

export function useI18n(): I18n {
  const instance = currentInstance();
  const runtime = instance.runtime;
  useEffect(() => {
    const sub = runtime.i18n.onChange(() => invalidate(instance, 'locale'));
    return () => sub.dispose();
  }, []);
  return runtime.i18n;
}

export function useService<T>(key: ServiceKey<T>): T | undefined {
  return useRuntime().services.get(key);
}

export function useRequiredService<T>(key: ServiceKey<T>): T {
  return useRuntime().services.require(key);
}

// ------------------------------------------------------------------ focus

export interface UseFocusOptions {
  id?: string;
  disabled?: boolean;
  skipTab?: boolean;
  autoFocus?: boolean;
  order?: number;
  scopeId?: string;
  onFocus?(): void;
  onBlur?(): void;
}

export interface FocusHandle {
  id: string;
  focused: boolean;
  focus(): void;
  blur(): void;
  move(direction: FocusDirection): void;
}

/**
 * The context key a focus scope publishes itself under.
 *
 * Not a `createContext` value because nothing renders a provider: a scope is
 * declared by a hook inside the component that owns it, and every focusable
 * below it has to inherit the scope without being wrapped in anything.
 */
const FOCUS_SCOPE_CONTEXT = 'textui.focusScope';

/** The focus scope this instance sits inside, if any. */
export function focusScopeOf(instance: Instance): string | undefined {
  const found = readContext(instance, FOCUS_SCOPE_CONTEXT);
  return typeof found === 'string' ? found : undefined;
}

export function useFocus(options: UseFocusOptions = {}): FocusHandle {
  const instance = currentInstance();
  const runtime = instance.runtime;
  const idRef = useRef(options.id ?? `${instance.id}:focus`);
  const id = options.id ?? idRef.current;

  // A control inside a dialog belongs to the dialog's scope. Registering in
  // the global one instead is invisible until something traps focus, and then
  // tab stops working entirely: the trap filters the tab order down to its own
  // scope, and every control it contains has been filed somewhere else.
  const scopeId = options.scopeId ?? focusScopeOf(instance);

  useEffect(() => {
    const registration = runtime.focus.register({
      id,
      disabled: options.disabled,
      skipTab: options.skipTab,
      order: options.order,
      scopeId,
      onFocus: () => {
        invalidate(instance, 'focus');
        options.onFocus?.();
      },
      onBlur: () => {
        invalidate(instance, 'blur');
        options.onBlur?.();
      },
    });
    // `autoFocus` claims focus, it does not steal it. A prompt dialog has an
    // auto-focused field *and* a default button, and whichever mounted last
    // would otherwise win - which is how a text field ends up unfocused in the
    // dialog that exists to ask for text.
    if (options.autoFocus) {
      const current = runtime.focus.focused();
      const claimed = current !== null
        && runtime.focus.scopeOf(current) === (scopeId ?? GLOBAL_SCOPE);
      if (!claimed) runtime.focus.focus(id);
    }
    return () => registration.dispose();
    // Only identity is a reason to register again. `disabled`, `skipTab` and
    // `order` are *state on* a focusable, not a different focusable - and
    // re-registering to change one costs the control its place in the tab
    // order, because a registration that was disposed and made again goes on
    // the end. A Submit button that is disabled until a field is filled in
    // therefore ended up after Cancel the moment it became usable, which is
    // the one control the reader was tabbing towards.
  }, [id, scopeId]);

  // The mutable half, pushed rather than re-registered.
  useEffect(() => {
    if (!runtime.focus.has(id)) return;
    runtime.focus.update(id, {
      disabled: options.disabled,
      skipTab: options.skipTab,
      order: options.order,
    });
  }, [id, options.disabled, options.skipTab, options.order]);

  return {
    id,
    focused: runtime.focus.focused() === id,
    focus: () => runtime.focus.focus(id),
    blur: () => runtime.focus.blur(),
    move: (direction) => runtime.focus.move(direction),
  };
}

/** A focus scope. Modals trap; a sidebar does not. */
export function useFocusScope(options: { id?: string; trap?: boolean; restore?: boolean; autoFocus?: boolean; active?: boolean } = {}): string {
  const instance = currentInstance();
  const runtime = instance.runtime;
  const idRef = useRef(options.id ?? `${instance.id}:scope`);
  const id = options.id ?? idRef.current;
  const active = options.active ?? true;

  // Publish to the subtree during render, before any descendant registers.
  if (!instance.contexts) instance.contexts = new Map();
  instance.contexts.set(FOCUS_SCOPE_CONTEXT, id);

  useEffect(() => {
    const registration = runtime.focus.registerScope({
      id,
      trap: options.trap,
      restore: options.restore,
      autoFocus: options.autoFocus,
    });
    if (active) runtime.focus.activateScope(id);
    return () => {
      runtime.focus.deactivateScope(id);
      registration.dispose();
    };
  }, [id, options.trap, options.restore, active]);

  return id;
}

/**
 * Keyboard input. Scoped to focus by default - a handler that fires while
 * something else is focused is nearly always a bug, so `global` has to be
 * asked for.
 */
/**
 * A key that is not this control's to take.
 *
 * A list handles `pagedown`, and `ctrl+pagedown` is an application saying
 * "next file" over the top of it - one is navigation inside the control, the
 * other is a chord aimed past it. A control that switches on `event.name`
 * alone takes both, and the application's binding then works everywhere except
 * in the pane a person is actually looking at.
 */
export function chorded(event: KeyEvent): boolean {
  return event.ctrl || event.alt || event.meta;
}

export function useInput(
  handler: (event: KeyEvent) => boolean | void,
  options: { focusId?: string; global?: boolean; enabled?: boolean } = {},
): void {
  const instance = currentInstance();
  const runtime = instance.runtime;
  const ref = useRef(handler);
  ref.current = handler;

  const enabled = options.enabled ?? true;
  const focusId = options.focusId ?? `${instance.id}:focus`;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyEvent): boolean | void => ref.current(event);

    // A global handler is its own node. A scoped one attaches to the focusable
    // this component already registered - re-registering the same id would
    // replace it, quietly dropping its tab order and its focus callbacks.
    if (options.global) {
      // "Global" means the handler is not tied to a focusable, not that it
      // outranks a modal. A component inside a trapping scope - or one that
      // opened the trap itself, like the palette - files its handler there, or
      // the trap that owns the keyboard would exclude the very keys the layer
      // exists to read.
      const registration = runtime.focus.register({
        id: `${instance.id}:global`,
        skipTab: true,
        global: true,
        scopeId: focusScopeOf(instance) ?? '__global__',
        onKey,
      });
      return () => registration.dispose();
    }

    if (runtime.focus.has(focusId)) {
      runtime.focus.update(focusId, { onKey });
      return () => runtime.focus.update(focusId, { onKey: undefined });
    }

    const registration = runtime.focus.register({ id: focusId, onKey });
    return () => registration.dispose();
  }, [enabled, focusId, options.global]);
}

// --------------------------------------------------------------- commands

/**
 * The screen this is drawn inside: which one, and what it was given.
 *
 * Reads the published entry rather than props, so a control eight levels down
 * can ask which task it is showing without every box between it and the screen
 * forwarding an id it does not care about.
 */
export function useScreen<P = Record<string, unknown>>(): { id: string | null; params: P } {
  const id = useStoreValue<string | null>('$/layout/screen/current' as BindingPath, null);
  const params = useStoreValue<P>('$/layout/screen/params' as BindingPath);
  return { id: id ?? null, params: (params ?? {}) as P };
}

/** The stack, for a component that moves between screens. */
export function useNavigate(): Navigator {
  return useApp().screens;
}

export function useCommand(def: Omit<CommandDefinition, 'scopeId'>, deps: unknown[] = []): void {
  const instance = currentInstance();
  const runtime = instance.runtime;
  const app = runtime.app();

  useEffect(() => {
    if (!app) return;
    const registration = app.commands.register({ ...def, scopeId: instance.id });
    return () => registration.dispose();
  }, [def.id, ...deps]);
}

export function useExecute(): (id: string, args?: Record<string, unknown>) => unknown {
  const runtime = useRuntime();
  return (id, args) => runtime.execute(id, args);
}

// ------------------------------------------------------------------ async

export interface TaskHandle<T> extends TaskState<T> {
  run(...args: unknown[]): Promise<T | undefined>;
  cancel(): void;
  reset(): void;
}

/**
 * An async unit of work with a lifecycle a component can render: idle,
 * running, success, error, cancelled - plus progress and cancellation.
 */
export function useTask<T>(fn: TaskFn<T>, deps: unknown[] = []): TaskHandle<T> {
  const instance = currentInstance();
  const [state, setState] = useState<TaskState<T>>({ status: 'idle' });
  const controller = useRef<AbortController | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => () => controller.current?.abort(), []);

  const run = useCallback(
    async (...args: unknown[]): Promise<T | undefined> => {
      controller.current?.abort();
      const ac = new AbortController();
      controller.current = ac;

      setState({ status: 'running', startedAt: Date.now() });
      try {
        const value = await fnRef.current(
          {
            signal: ac.signal,
            progress: (progress, step) =>
              setState((prev) => ({ ...prev, progress, step })),
          },
          ...args,
        );
        if (ac.signal.aborted) {
          setState((prev) => ({ ...prev, status: 'cancelled', finishedAt: Date.now() }));
          return undefined;
        }
        setState({ status: 'success', data: value, finishedAt: Date.now() });
        return value;
      } catch (error) {
        if (ac.signal.aborted) {
          setState((prev) => ({ ...prev, status: 'cancelled', finishedAt: Date.now() }));
          return undefined;
        }
        setState({ status: 'error', error, finishedAt: Date.now() });
        instance.runtime.onError(error, `task in <${instance.component}>`);
        return undefined;
      }
    },
    deps,
  ) as (...args: unknown[]) => Promise<T | undefined>;

  return {
    ...state,
    run,
    cancel: () => controller.current?.abort(),
    reset: () => setState({ status: 'idle' }),
  };
}

/** A task that runs on mount and can be refreshed. */
export function useResource<T>(
  fn: TaskFn<T>,
  deps: unknown[] = [],
): TaskHandle<T> & { refresh(): void } {
  const task = useTask(fn, deps);
  useEffect(() => {
    void task.run();
  }, deps);
  return { ...task, refresh: () => void task.run() };
}

/** Read a resource through the registry, by URI. */
export function useResourceUri(uri: string | null): {
  resource: Resource | null;
  content: string | Uint8Array | null;
  status: TaskState['status'];
  error: unknown;
  refresh(): void;
} {
  const app = useRuntime().app();
  const task = useResource(async () => {
    if (!uri || !app) return null;
    const resource = await app.resources.stat(uri);
    if (!resource) return null;
    const content = resource.capabilities.includes('read')
      ? await app.resources.read(uri)
      : null;
    return { resource, content };
  }, [uri]);

  return {
    resource: task.data?.resource ?? null,
    content: task.data?.content ?? null,
    status: task.status,
    error: task.error,
    refresh: task.refresh,
  };
}

// ---------------------------------------------------------------- syntax

/** The highlighter registry, or undefined outside an application. */
export function useSyntax(): SyntaxRegistry | undefined {
  return useRuntime().app()?.syntax;
}

/**
 * Tokenise text for display, memoised on the text and the query.
 *
 * Nothing registered for this kind means one plain token per line, which is
 * exactly what an uncoloured viewer wants - so a caller never branches on
 * whether highlighting exists.
 */
export function useHighlight(text: string, query: SyntaxQuery = {}): SyntaxToken[][] {
  const syntax = useSyntax();
  const { kind, uri, language } = query;
  return useMemo(
    () => (syntax ? syntax.tokenize(text, { kind, uri, language }) : plainTokens(text)),
    [syntax, text, kind, uri, language],
  );
}

// -------------------------------------------------------------- clipboard

export interface ClipboardHandle {
  /** What is on the clipboard now. Reading it here means a menu row that
   *  offers "Paste" redraws when there is something to paste. */
  text: string;
  read(): string;
  write(text: string): void;
}

/**
 * The clipboard, as a hook.
 *
 * `write` puts the text on the system clipboard as well, when the terminal
 * can take it. Nothing reads the system clipboard back - see
 * `core/clipboard.ts` for why - so a paste is whatever this application last
 * copied, plus whatever the terminal delivers as a bracketed paste.
 */
export function useClipboard(): ClipboardHandle {
  const runtime = useRuntime();
  const text = useStoreValue<string>(CLIPBOARD_PATH, '') ?? '';
  return {
    text,
    read: () => readClipboard(runtime.store),
    write: (next: string) => writeClipboard(runtime.store, next, runtime.app()?.terminal),
  };
}

// ---------------------------------------------------------------- streams

/** The most recent `limit` values from any stream source. */
export function useStream<T>(
  source: StreamSource<T> | null,
  options: { limit?: number } = {},
): T[] {
  const instance = currentInstance();
  const limit = options.limit ?? 500;
  const buffer = useRef<T[]>([]);

  useEffect(() => {
    if (!source) return;
    buffer.current = [];
    const stream: Stream<T> = toStream(source);
    const sub = stream.subscribe({
      next(value) {
        buffer.current.push(value);
        if (buffer.current.length > limit) {
          buffer.current.splice(0, buffer.current.length - limit);
        }
        invalidate(instance, 'stream');
      },
      error(err) {
        instance.runtime.onError(err, `stream in <${instance.component}>`);
      },
    });
    return () => sub.dispose();
  }, [source, limit]);

  return buffer.current;
}

// -------------------------------------------------------------- animation

/** A frame ticker, throttled and globally disableable by the driver. */
export function useTicker(
  onTick: (frame: number, elapsedMs: number) => void,
  options: { fps?: number; enabled?: boolean } = {},
): void {
  const runtime = useRuntime();
  const ref = useRef(onTick);
  ref.current = onTick;
  const enabled = options.enabled ?? true;

  useEffect(() => {
    if (!enabled) return;
    const ticker = runtime.animation.ticker({
      fps: options.fps,
      onTick: (frame, elapsed) => ref.current(frame, elapsed),
    });
    return () => ticker.dispose();
  }, [enabled, options.fps]);
}

/** A frame counter, for spinners and marquees. Frozen when animation is off. */
export function useFrame(fps = 10): number {
  const instance = currentInstance();
  const [frame, setFrame] = useState(0);
  const disabled = instance.runtime.animation.disabled;

  useTicker(() => setFrame((f) => f + 1), { fps, enabled: !disabled });
  return disabled ? 0 : frame;
}

/** A value that eases towards its target. Snaps when animation is off. */
export function useTween(target: number, durationMs = 200): number {
  const runtime = useRuntime();
  const [value, setValue] = useState(target);
  const from = useRef(target);

  useEffect(() => {
    if (runtime.animation.disabled || durationMs <= 0) {
      from.current = target;
      setValue(target);
      return;
    }
    const tween = runtime.animation.tween({
      from: from.current,
      to: target,
      durationMs,
      onUpdate: (v) => setValue(v),
      onComplete: () => { from.current = target; },
    });
    return () => tween.dispose();
  }, [target, durationMs]);

  return runtime.animation.disabled ? target : value;
}

export function useInterval(fn: () => void, ms: number, enabled = true): void {
  const ref = useRef(fn);
  ref.current = fn;

  useEffect(() => {
    if (!enabled || ms <= 0) return;
    const timer = setInterval(() => ref.current(), ms);
    (timer as unknown as { unref?: () => void }).unref?.();
    return () => clearInterval(timer);
  }, [ms, enabled]);
}

/** Register a disposable for the lifetime of this component. */
export function useDisposable(factory: () => Disposable, deps: unknown[] = []): void {
  useEffect(() => {
    const d = factory();
    return () => d.dispose();
  }, deps);
}
