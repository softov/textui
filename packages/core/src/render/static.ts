import type { ComponentNode } from '../types/graph.js';
import type { ComponentDefinition } from '../types/component-registry.js';
import type { ThemeDefinition } from '../types/theme.js';
import type { TerminalCapabilities, CapabilityOverrides } from '../types/capabilities.js';
import type { Instance } from '../runtime/instance.js';
import type { Runtime } from '../runtime/runtime.js';
import type { LayoutBox } from './layout.js';
import { Buffer } from './buffer.js';
import { layout, resolveEdges } from './layout.js';
import { buildBoxes, paintTree, type PaintEnv } from '../runtime/paint.js';
import { collectEffects, disposeTree, renderTree } from '../runtime/reconcile.js';
import { flushMeasures } from '../runtime/hooks.js';
import { NO_INTERACTION } from '../runtime/style.js';
import { createStore } from '../core/store.js';
import { createEvents } from '../core/events.js';
import { createWhen } from '../core/when.js';
import { createComponents } from '../core/components.js';
import { createServices } from '../core/services.js';
import { createFocus } from '../core/focus.js';
import { createLayers } from '../core/layers.js';
import { createAnimation } from '../core/animation.js';
import { createI18n } from '../core/i18n.js';
import { createThemes } from '../themes/registry.js';
import { PRIMITIVES } from '../ui/primitives.js';
import { FULL_CAPABILITIES } from '../types/capabilities.js';
import { ZERO_EDGES } from '../types/geometry.js';

/**
 * One-shot rendering.
 *
 * The same component model, no terminal and no frame loop - which is what
 * makes it useful for reports, `--help` output, generated documentation and
 * tests. A component that only works interactively is a component that cannot
 * be tested cheaply, so this path is not an afterthought.
 *
 * `renderOnce`, not `render`, because the difference that matters is lifetime.
 * This draws a frame and hands it back; `render` mounts an application onto a
 * terminal and keeps running. Two functions called `render` where one returns
 * a string and the other takes over your screen is a trap, not a convenience -
 * and every other library's `render` is the second one.
 */

export interface StaticRenderOptions {
  width?: number;
  height?: number | 'auto';
  theme?: string;
  themes?: ThemeDefinition[];
  /**
   * Components to register by name.
   *
   * Only nodes addressed by name need this. A screen written in JSX carries
   * its components with it - `<Card/>` compiles to a node holding the
   * imported function, and the runtime uses that in preference to any
   * registry - so this is for screens authored as data: JSON, a template
   * renderer, anything naming a component in a string.
   *
   * Pass `CATALOG` for the shipped set.
   */
  components?: ComponentDefinition[];
  capabilities?: CapabilityOverrides;
  locale?: string;
  /** Seed the store before rendering. */
  initialState?: Record<string, unknown>;
  /** Passes allowed for effects that change state. */
  maxPasses?: number;
  onError?(err: unknown, context: string): void;
}

export interface StaticRenderResult {
  buffer: Buffer;
  text: string;
  root: Instance;
  runtime: Runtime;
  /** Release subscriptions and timers. Always call this. */
  dispose(): void;
}

const DEFAULT_CAPABILITIES: TerminalCapabilities = {
  ...FULL_CAPABILITIES,
  mouse: false,
  wheel: false,
  focusEvents: false,
  paste: false,
  altScreen: false,
  synchronizedOutput: false,
  kittyKeyboard: false,
};

export function createStaticRuntime(options: StaticRenderOptions = {}): {
  runtime: Runtime;
  setSize(width: number, height: number): void;
  dispose(): void;
} {
  const store = createStore();
  const events = createEvents();
  const when = createWhen(store);
  const components = createComponents();
  const services = createServices();
  const focus = createFocus();
  const layers = createLayers();
  const animation = createAnimation({ manual: true, enabled: false });
  const i18n = createI18n(options.locale ?? 'en');
  const themes = createThemes(options.themes);

  // The four primitives, and nothing else by default.
  //
  // This registered the whole catalog until it didn't: some eighty entries a
  // screen made of `box` and `text` never looked at, and that JSX never
  // needed either, since an imported component travels on its own node.
  // Naming a component in data is the case a registry is for, and that case
  // asks for it through `components`.
  components.registerMany(PRIMITIVES);
  if (options.components) components.registerMany(options.components);

  const capabilities: TerminalCapabilities = {
    ...DEFAULT_CAPABILITIES,
    ...options.capabilities,
  };

  let size = { width: options.width ?? 80, height: 24 };

  const onError = options.onError ?? ((err: unknown, context: string) => {
    console.error(`[textui] ${context}`, err);
  });

  store.onError = onError;
  events.onError = onError;

  if (options.initialState) {
    store.batch(() => {
      for (const [path, value] of Object.entries(options.initialState as object)) {
        store.set((path.startsWith('$/') ? path : `$/${path}`) as `$/${string}`, value);
      }
    });
  }

  store.set('$/modus/capabilities', capabilities);
  store.set('$/modus/size', size);

  const runtime: Runtime = {
    store, events, when, components, services, focus, layers, animation, i18n,
    theme: () => themes.resolve(options.theme ?? 'dark', capabilities),
    capabilities: () => capabilities,
    size: () => size,
    execute: (id) => {
      throw new Error(`[textui] command "${id}" cannot run under the static renderer`);
    },
    emit: (path, payload) => events.emit(path as `@/${string}`, payload),
    requestRender: () => {},
    app: () => null,
    onError,
  };

  return {
    runtime,
    setSize(width, height) {
      size = { width, height };
      store.set('$/modus/size', size);
    },
    dispose() {
      animation.dispose();
      layers.dispose();
      events.dispose();
      store.dispose();
    },
  };
}

function rootBoxFor(children: LayoutBox[]): LayoutBox {
  return {
    style: { direction: 'column' },
    borderEdges: ZERO_EDGES,
    children,
    rect: { x: 0, y: 0, width: 0, height: 0 },
    content: { x: 0, y: 0, width: 0, height: 0 },
  };
}

export function renderOnce(
  node: ComponentNode,
  options: StaticRenderOptions = {},
): StaticRenderResult {
  const width = options.width ?? 80;
  const { runtime, setSize, dispose: disposeRuntime } = createStaticRuntime(options);

  // Measure against a generous height first when the caller wants `auto`, so
  // nothing is clipped before we know how tall the content actually is.
  const measureHeight = options.height === 'auto' || options.height === undefined
    ? 4096
    : options.height;
  setSize(width, measureHeight);

  const env: PaintEnv = {
    theme: runtime.theme(),
    capabilities: runtime.capabilities(),
    stateOf: () => NO_INTERACTION,
  };

  let root: Instance | null = null;
  const maxPasses = options.maxPasses ?? 8;

  for (let pass = 0; pass < maxPasses; pass++) {
    root = renderTree(runtime, root, node);
    const effects = collectEffects(root);
    if (effects.length === 0) break;
    for (const effect of effects) effect();
    if (!hasDirty(root)) break;
  }

  let instance = root as Instance;
  let boxes = buildBoxes(instance, env);
  let rootBox = rootBoxFor(boxes);
  layout(rootBox, { x: 0, y: 0, width, height: measureHeight });

  // A measured component only knows its size once it has been laid out. Give
  // it that, then render again - otherwise the static renderer is the one
  // place where a viewport draws nothing.
  for (let pass = 0; pass < maxPasses && flushMeasures(); pass++) {
    instance = renderTree(runtime, instance, node);
    for (const effect of collectEffects(instance)) effect();
    boxes = buildBoxes(instance, env);
    rootBox = rootBoxFor(boxes);
    layout(rootBox, { x: 0, y: 0, width, height: measureHeight });
  }

  const used = contentHeight(rootBox);
  const height = options.height === 'auto' || options.height === undefined
    ? Math.max(1, used)
    : options.height;

  // Lay out again at the real height so `flex` and `justify` see the truth.
  if (height !== measureHeight) {
    setSize(width, height);
    layout(rootBox, { x: 0, y: 0, width, height });

    for (let pass = 0; pass < maxPasses && flushMeasures(); pass++) {
      instance = renderTree(runtime, instance, node);
      for (const effect of collectEffects(instance)) effect();
      rootBox = rootBoxFor(buildBoxes(instance, env));
      layout(rootBox, { x: 0, y: 0, width, height });
    }
  }

  const buffer = new Buffer(width, height);
  paintTree(buffer, instance, env, { x: 0, y: 0, width, height });

  return {
    buffer,
    text: buffer.toText(),
    root: instance,
    runtime,
    dispose() {
      disposeTree(instance);
      disposeRuntime();
    },
  };
}

/** Render to plain text. The shortest path from a component to a string. */
export function renderToString(node: ComponentNode, options: StaticRenderOptions = {}): string {
  const result = renderOnce(node, options);
  try {
    return result.text;
  } finally {
    result.dispose();
  }
}

function contentHeight(box: LayoutBox): number {
  let bottom = 0;
  const walk = (b: LayoutBox): void => {
    if (b.rect.width > 0 && b.rect.height > 0) {
      // Plus the margin below it, which is space the box needs even though
      // nothing paints there. Measuring to the bottom edge alone reports a
      // height the layout cannot reproduce: laid out again inside it, the
      // margin has to come out of the box, and the box loses the rows.
      // `<box margin={2} border="single">` measured 5 and then drew one row
      // of a three-row box.
      bottom = Math.max(bottom, b.rect.y + b.rect.height + resolveEdges(b.style.margin).bottom);
    }
    for (const child of b.children) walk(child);
  };
  for (const child of box.children) walk(child);
  return bottom;
}

function hasDirty(instance: Instance): boolean {
  if (instance.dirty) return true;
  return instance.children.some(hasDirty);
}
