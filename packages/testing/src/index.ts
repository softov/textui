import type {
  CapabilityOverrides,
  ComponentDefinition,
  ComponentNode,
  Disposable,
  InspectorNode,
  KeyEvent,
  TextUIApp,
  ReactiveStore,
  SemanticRole,
  ThemeDefinition,
} from '@textui/core';
import { WRITER_KEY, createApp, strokeOf, splitStroke, type App, createBag } from '@textui/core';
import { registerBuiltins } from '@textui/widgets';
import { createVirtualTerminal, createWriter, type VirtualTerminalAdapter } from '@textui/terminal';

/**
 * The testing harness.
 *
 * It drives a real application against a virtual terminal, so what a test
 * asserts is what a terminal would receive. Queries are semantic first -
 * by role, by label, by text - because a test pinned to exact ANSI output
 * fails on every legitimate change and passes on none of the interesting bugs.
 * Snapshots are still here for when the layout itself is the thing under test.
 */

export interface RenderOptions {
  width?: number;
  height?: number;
  theme?: string;
  themes?: ThemeDefinition[];
  shell?: string;
  components?: ComponentDefinition[];
  capabilities?: CapabilityOverrides;
  locale?: string;
  initialState?: Record<string, unknown>;
  /** Register the shipped catalog. On by default. */
  builtins?: boolean;
  /**
   * Run boot registration before the first frame.
   *
   * Mirrors the application's own `onBoot`, disposable and all - a harness
   * whose boot contract is narrower than the real one is a harness that
   * cannot test what the real one does.
   */
  onBoot?(app: TextUIApp): void | Disposable | Promise<void | Disposable>;
  /** Encode frames to ANSI as a real terminal session would. Off by default. */
  encode?: boolean;
  /** Collect errors instead of printing them. On by default. */
  captureErrors?: boolean;
  /**
   * Whether anything is allowed to move. On by default, and driven by hand -
   * `advance` is the clock.
   *
   * Off is the reader who asked for stillness, and it is a behaviour worth
   * testing rather than assuming: a component that animates has a second
   * rendering nobody sees until somebody sets this.
   */
  animations?: boolean;
}

export interface QueryOptions {
  /** Match the whole string rather than a substring. */
  exact?: boolean;
}

export interface Element {
  id: string;
  component: string;
  role?: string;
  label?: string;
  text?: string;
  rect?: { x: number; y: number; width: number; height: number };
  focused: boolean;
  props: Record<string, unknown>;
  children: Element[];
}

export interface Harness {
  readonly app: TextUIApp;
  readonly store: ReactiveStore;
  readonly terminal: VirtualTerminalAdapter;

  // --- output ---
  /** The frame as plain text, trailing spaces trimmed. */
  text(): string;
  /** One row of the frame. */
  line(y: number): string;
  /** Every line, as an array. */
  lines(): string[];
  /** The encoded bytes written since the last `clearOutput`. */
  output(): string;
  clearOutput(): void;
  /** The semantic tree, for structural assertions. */
  tree(): InspectorNode | null;

  // --- queries ---
  getByRole(role: SemanticRole, options?: QueryOptions & { name?: string }): Element;
  queryByRole(role: SemanticRole, options?: QueryOptions & { name?: string }): Element | null;
  getAllByRole(role: SemanticRole): Element[];
  getByLabel(label: string, options?: QueryOptions): Element;
  queryByLabel(label: string, options?: QueryOptions): Element | null;
  getByText(text: string, options?: QueryOptions): Element;
  queryByText(text: string, options?: QueryOptions): Element | null;
  getAllByText(text: string, options?: QueryOptions): Element[];
  getByComponent(name: string): Element;
  getAllByComponent(name: string): Element[];
  /** True when the text appears anywhere in the frame. */
  hasText(text: string): boolean;

  // --- input ---
  /** Send one chord: `a`, `enter`, `ctrl+p`, `shift+tab`. */
  press(chord: string): void;
  /** Send several chords in order. */
  pressAll(...chords: string[]): void;
  /** Type a string, one key at a time. */
  type(text: string): void;
  paste(text: string): void;
  click(x: number, y: number, button?: 'left' | 'middle' | 'right'): void;
  /** Click the centre of an element. */
  clickOn(element: Element): void;
  moveMouse(x: number, y: number): void;
  wheel(x: number, y: number, delta: number): void;
  focusTerminal(focused: boolean): void;
  /** Feed raw terminal bytes, exercising the decoder too. */
  feed(data: string): void;

  // --- environment ---
  resize(width: number, height: number): void;
  setCapabilities(overrides: CapabilityOverrides): void;
  setTheme(id: string): void;
  setShell(id: string): void;

  // --- time ---
  /** Advance the animation clock and render. */
  advance(ms: number): void;
  /** Render now, outside the scheduler. */
  flush(): void;
  /** Let queued promises settle, then render. */
  settle(): Promise<void>;

  // --- focus ---
  focused(): Element | null;
  focus(id: string): void;
  tab(): void;
  shiftTab(): void;

  // --- diagnostics ---
  errors(): { context: string; message: string }[];
  stats(): { renders: number; runs: number; instances: number };

  unmount(): Promise<void>;
}

/** A harness that has already started. */
export async function render(
  node: ComponentNode,
  options: RenderOptions = {},
): Promise<Harness> {
  return mount({ ...options, root: node });
}

/** Mount an application rather than a bare node. */
export async function renderApp(options: RenderOptions = {}): Promise<Harness> {
  return mount(options);
}

async function mount(options: RenderOptions & { root?: ComponentNode }): Promise<Harness> {
  const width = options.width ?? 80;
  const height = options.height ?? 24;

  const terminal = createVirtualTerminal({
    width,
    height,
    capabilities: options.capabilities,
    managed: false,
  });

  const errors: { context: string; message: string }[] = [];

  const app = createApp({
    terminal,
    root: options.root,
    // Only pass a theme when the caller named one, so a shell's own default
    // still applies - passing 'dark' here would silently override it.
    ...(options.theme ? { theme: options.theme } : {}),
    themes: options.themes,
    shell: options.shell ?? 'plain',
    locale: options.locale,
    animations: options.animations ?? true,
    diagnostics: true,
    session: { managed: false, altScreen: false, hideCursor: false },
    onBoot: async (booted) => {
      // Everything registered here comes back out when the app stops, which
      // matters for a harness more than for an application: a test file
      // mounts and unmounts dozens of times in one process.
      const bag = createBag();
      if (options.builtins !== false) bag.add(registerBuiltins(booted));
      if (options.components) bag.add(booted.components.registerMany(options.components));
      if (options.initialState) {
        booted.store.batch(() => {
          for (const [path, value] of Object.entries(options.initialState as object)) {
            booted.store.set((path.startsWith('$/') ? path : `$/${path}`) as `$/${string}`, value);
          }
        });
      }
      const booted_ = await options.onBoot?.(booted);
      if (booted_) bag.add(booted_);
      return bag;
    },
  });

  if (options.encode) {
    app.services.provide(WRITER_KEY, createWriter(terminal.capabilities()));
  }

  app.store.subscribe(
    '$/modus/diagnostics/errors',
    (value) => {
      const list = Array.isArray(value) ? value : [];
      errors.length = 0;
      for (const entry of list) {
        errors.push(entry as { context: string; message: string });
      }
    },
    { subtree: true },
  );

  await app.start();
  app.flush();

  return createHarness(app as App, terminal, errors);
}

function createHarness(
  app: App,
  terminal: VirtualTerminalAdapter,
  errors: { context: string; message: string }[],
): Harness {
  const flush = (): void => app.flush();

  const collect = (predicate: (node: InspectorNode) => boolean): Element[] => {
    const tree = app.inspect();
    if (!tree) return [];
    const found: Element[] = [];
    const walk = (node: InspectorNode): void => {
      if (predicate(node)) found.push(toElement(node));
      for (const child of node.children) walk(child);
    };
    walk(tree);
    return found;
  };

  const textOf = (node: InspectorNode): string => {
    const parts: string[] = [];
    const walk = (n: InspectorNode): void => {
      if (typeof n.text === 'string') parts.push(n.text);
      for (const child of n.children) walk(child);
    };
    walk(node);
    return parts.join(' ');
  };

  const matches = (haystack: string | undefined, needle: string, exact?: boolean): boolean => {
    if (haystack === undefined) return false;
    return exact ? haystack === needle : haystack.includes(needle);
  };

  const require1 = (found: Element[], what: string): Element => {
    if (found.length === 0) {
      throw new Error(
        `[textui/testing] no element matching ${what}\n\n${app.buffer().toText()}`,
      );
    }
    if (found.length > 1) {
      const list = found.map((e) => `  <${e.component}> ${e.label ?? e.text ?? ''}`).join('\n');
      throw new Error(
        `[textui/testing] ${found.length} elements match ${what}; narrow the query\n${list}`,
      );
    }
    return found[0] as Element;
  };

  const sendKey = (chord: string): void => {
    for (const event of chordToEvents(chord)) app.handleInput(event);
    flush();
  };

  return {
    app,
    store: app.store,
    terminal,

    text: () => app.buffer().toText(),
    line: (y) => app.buffer().toText().split('\n')[y] ?? '',
    lines: () => app.buffer().toText().split('\n'),
    output: () => terminal.output(),
    clearOutput: () => terminal.clearOutput(),
    tree: () => app.inspect(),

    getByRole(role, options = {}) {
      const found = collect((n) =>
        n.role === role && (options.name === undefined || matches(n.label ?? textOf(n), options.name, options.exact)));
      return require1(found, `role "${role}"${options.name ? ` named "${options.name}"` : ''}`);
    },
    queryByRole(role, options = {}) {
      const found = collect((n) =>
        n.role === role && (options.name === undefined || matches(n.label ?? textOf(n), options.name, options.exact)));
      return found[0] ?? null;
    },
    getAllByRole: (role) => collect((n) => n.role === role),

    getByLabel(label, options = {}) {
      return require1(collect((n) => matches(n.label, label, options.exact)), `label "${label}"`);
    },
    queryByLabel(label, options = {}) {
      return collect((n) => matches(n.label, label, options.exact))[0] ?? null;
    },

    getByText(text, options = {}) {
      return require1(collect((n) => matches(n.text, text, options.exact)), `text "${text}"`);
    },
    queryByText(text, options = {}) {
      return collect((n) => matches(n.text, text, options.exact))[0] ?? null;
    },
    getAllByText: (text, options = {}) => collect((n) => matches(n.text, text, options.exact)),

    getByComponent(name) {
      return require1(collect((n) => n.component === name), `component <${name}>`);
    },
    getAllByComponent: (name) => collect((n) => n.component === name),

    hasText: (text) => app.buffer().toText().includes(text),

    press: sendKey,
    pressAll(...chords) {
      for (const chord of chords) sendKey(chord);
    },
    type(text) {
      for (const char of [...text]) {
        app.handleInput({
          type: 'key', name: char, char, raw: char,
          ctrl: false, alt: false, meta: false,
          shift: char !== char.toLowerCase(),
          handled: false,
        });
      }
      flush();
    },
    paste(text) {
      app.handleInput({ type: 'paste', text, handled: false });
      flush();
    },
    click(x, y, button = 'left') {
      app.handleInput({ type: 'mouse', action: 'down', button, x, y, ctrl: false, alt: false, shift: false, handled: false });
      app.handleInput({ type: 'mouse', action: 'up', button, x, y, ctrl: false, alt: false, shift: false, handled: false });
      flush();
    },
    clickOn(element) {
      const rect = element.rect;
      if (!rect) throw new Error(`[textui/testing] <${element.component}> has no bounds to click`);
      this.click(rect.x + Math.floor(rect.width / 2), rect.y + Math.floor(rect.height / 2));
    },
    moveMouse(x, y) {
      app.handleInput({ type: 'mouse', action: 'move', button: 'none', x, y, ctrl: false, alt: false, shift: false, handled: false });
      flush();
    },
    wheel(x, y, delta) {
      app.handleInput({ type: 'mouse', action: 'wheel', button: 'none', x, y, wheel: delta, ctrl: false, alt: false, shift: false, handled: false });
      flush();
    },
    focusTerminal(focused) {
      app.handleInput({ type: 'terminal-focus', focused });
      flush();
    },
    feed(data) {
      terminal.feed(data);
      flush();
    },

    resize(width, height) {
      terminal.resize(width, height);
      flush();
    },
    setCapabilities(overrides) {
      app.setCapabilityOverrides(overrides);
      flush();
    },
    setTheme(id) {
      app.setTheme(id);
      flush();
    },
    setShell(id) {
      app.setShell(id);
      flush();
    },

    advance(ms) {
      app.animation.advance(ms);
      flush();
    },
    flush,
    async settle() {
      // Two turns: one for the promise that is pending, one for whatever it
      // schedules. Anything deeper is a test that should await explicitly.
      await Promise.resolve();
      await new Promise((resolve) => setImmediate(resolve));
      flush();
    },

    focused() {
      const id = app.focus.focused();
      if (!id) return null;
      const found = collect((n) => n.focused === true);
      return found[0] ?? null;
    },
    focus(id) {
      app.focus.focus(id);
      flush();
    },
    tab: () => sendKey('tab'),
    shiftTab: () => sendKey('shift+tab'),

    errors: () => [...errors],
    stats: () => app.stats(),

    async unmount() {
      await app.stop();
      app.dispose();
    },
  };
}

function toElement(node: InspectorNode): Element {
  return {
    id: node.id,
    component: node.component,
    role: node.role,
    label: node.label,
    text: node.text,
    rect: node.rect,
    focused: node.focused === true,
    props: node.props,
    children: node.children.map(toElement),
  };
}

/** `ctrl+shift+p`, `enter`, `a`. The inverse of `strokeOf`. */
export function chordToEvents(chord: string): KeyEvent[] {
  return chord
    .trim()
    .split(/\s+/)
    .map((stroke) => {
      // The registry's parser, not a second one: a chord pressed here has to
      // produce the stroke the registry stored it under, or a binding that
      // works in a terminal fails in a test and nobody can tell which is right.
      const { mods: names, key } = splitStroke(stroke);
      const mods = new Set(names);
      // `space` is named and printable at once - the decoder emits both, and a
      // press that gave only the name could not be typed into a field.
      const char = key === 'space' ? ' ' : ([...key].length === 1 ? key : undefined);

      return {
        type: 'key' as const,
        name: key,
        char,
        ctrl: mods.has('ctrl') || mods.has('control'),
        alt: mods.has('alt') || mods.has('option'),
        shift: mods.has('shift'),
        meta: mods.has('meta') || mods.has('cmd') || mods.has('super'),
        raw: stroke,
        handled: false,
      };
    });
}

export { strokeOf };

/**
 * A stable text snapshot: the frame, with a ruler, so a diff shows which
 * column moved rather than only that something did.
 */
export function snapshot(harness: Harness, options: { ruler?: boolean } = {}): string {
  const lines = harness.lines();
  if (!options.ruler) return lines.join('\n');

  const width = Math.max(0, ...lines.map((l) => l.length));
  const tens = Array.from({ length: width }, (_, i) => (i % 10 === 0 ? String((i / 10) % 10) : ' ')).join('');
  const ones = Array.from({ length: width }, (_, i) => String(i % 10)).join('');
  return [tens, ones, ...lines].join('\n');
}
