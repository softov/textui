import type { BindingPath, ComponentNode } from '../types/graph.js';
import type { ComponentDefinition } from '../types/component-registry.js';
import type { Disposable } from '../types/disposable.js';
import type { FunctionComponent, HostComponent, RenderOutput } from '../types/render.js';
import type { LayoutBox } from '../render/layout.js';
import type { Rect } from '../types/geometry.js';
import type { Runtime } from './runtime.js';
import { isComponentNode } from '../types/graph.js';
import { ZERO_EDGES } from '../types/geometry.js';
import { isTemplateChildren, resolveProps, type ResolveContext } from './bindings.js';
import { nodeFunction } from '../jsx/factory.js';
import { joinPath } from '../util/paths.js';

export type HookSlot = {
  kind: string;
  value: unknown;
  deps?: unknown[];
  cleanup?: (() => void) | void;
};

export type InstanceKind = 'function' | 'host' | 'template' | 'missing';

/**
 * One mounted node.
 *
 * The tree is retained between frames, which is the whole reason hooks can
 * hold state and the renderer can diff rather than redraw: an instance whose
 * node and props are unchanged is not re-rendered at all.
 */
export interface Instance {
  id: string;
  component: string;
  kind: InstanceKind;
  key: string | number | undefined;

  node: ComponentNode;
  props: Record<string, unknown>;

  fn?: FunctionComponent;
  host?: HostComponent;
  definition?: ComponentDefinition;

  parent: Instance | null;
  children: Instance[];

  hooks: HookSlot[];
  hookIndex: number;

  /** Store paths this instance's props read. Re-render when one changes. */
  reads: Set<string>;
  subscriptions: Disposable[];

  dataContext?: BindingPath;
  /** Context values provided by this instance, by context id. */
  contexts?: Map<string, unknown>;

  dirty: boolean;
  /**
   * A descendant is dirty. Without this the render pass stops at the first
   * clean ancestor and never reaches the component that actually changed -
   * which is exactly what happens when a text field deep inside a mounted
   * surface updates its own state.
   */
  childDirty: boolean;
  mounted: boolean;
  /** Set when this subtree threw; a boundary renders its fallback instead. */
  error?: unknown;
  /** Why the last render ran. Diagnostics only. */
  renderReason?: string;

  /** Filled by the layout pass for host instances. */
  box?: LayoutBox;
  /** Last content rect observed by `useMeasure`, if this instance asked. */
  measured?: Rect;
  /** The child nodes produced by the last render, for a children-only pass. */
  lastChildren: { node: ComponentNode; dataContext?: BindingPath }[];
  /** Effects queued during this render, flushed after the frame commits. */
  pendingEffects: (() => void)[];

  runtime: Runtime;
}

let nextId = 1;

export function createInstance(
  runtime: Runtime,
  node: ComponentNode,
  parent: Instance | null,
): Instance {
  return {
    id: node.id ?? `n${nextId++}`,
    component: node.component,
    kind: 'missing',
    key: node.key,
    node,
    props: {},
    parent,
    children: [],
    hooks: [],
    hookIndex: 0,
    reads: new Set(),
    subscriptions: [],
    dataContext: parent?.dataContext,
    lastChildren: [],
    dirty: true,
    childDirty: false,
    mounted: false,
    pendingEffects: [],
    runtime,
  };
}

/** Flatten render output into nodes. Strings and numbers become text nodes. */
export function normalizeChildren(output: unknown): ComponentNode[] {
  const out: ComponentNode[] = [];

  const walk = (value: unknown): void => {
    if (value === null || value === undefined || value === false || value === true) return;
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (typeof value === 'string' || typeof value === 'number') {
      const content = String(value);
      if (content !== '') out.push({ component: 'text', content });
      return;
    }
    if (isComponentNode(value)) {
      out.push(value);
      return;
    }
    // Anything else is a programmer error worth seeing rather than swallowing.
    out.push({ component: 'text', content: String(value) });
  };

  walk(output as RenderOutput);
  return out;
}

/**
 * Expand `{ template, path }` into one node per item, each with its own data
 * context - which is what lets one templated node render a hundred rows.
 */
export function expandTemplate(
  runtime: Runtime,
  spec: { template: ComponentNode; path: BindingPath },
  dataContext: BindingPath | undefined,
): { nodes: ComponentNode[]; contexts: BindingPath[]; read: string } {
  const base = spec.path.startsWith('$/')
    ? spec.path
    : (joinPath(dataContext ?? '$/', spec.path) as BindingPath);

  const items = runtime.store.get<unknown[]>(base);
  const list = Array.isArray(items) ? items : [];

  const nodes: ComponentNode[] = [];
  const contexts: BindingPath[] = [];
  for (let i = 0; i < list.length; i++) {
    const item = list[i] as Record<string, unknown> | undefined;
    const key =
      item && typeof item === 'object' && 'id' in item ? String(item.id) : String(i);
    nodes.push({ ...spec.template, key });
    contexts.push(joinPath(base, String(i)) as BindingPath);
  }
  return { nodes, contexts, read: base };
}

export function resolveContextFor(instance: Instance): ResolveContext {
  return {
    store: instance.runtime.store,
    dataContext: instance.dataContext,
    execute: (id, args) => instance.runtime.execute(id, args),
    emit: (path, payload) => instance.runtime.emit(path, payload),
    reads: new Set<string>(),
  };
}

/** Look up a context value by walking the parent chain. */
export function readContext(instance: Instance, contextId: string): unknown {
  let cursor: Instance | null = instance;
  while (cursor) {
    const value = cursor.contexts?.get(contextId);
    if (value !== undefined) return value;
    cursor = cursor.parent;
  }
  return undefined;
}

export function emptyBox(): LayoutBox {
  return {
    style: {},
    borderEdges: ZERO_EDGES,
    children: [],
    rect: { x: 0, y: 0, width: 0, height: 0 },
    content: { x: 0, y: 0, width: 0, height: 0 },
  };
}

/** Depth-first walk, parents before children. */
export function walkInstances(root: Instance, visit: (i: Instance) => void): void {
  visit(root);
  for (const child of root.children) walkInstances(child, visit);
}

export function unmountInstance(instance: Instance): void {
  for (const child of instance.children) unmountInstance(child);
  instance.children = [];

  for (const hook of instance.hooks) {
    if (typeof hook.cleanup === 'function') {
      try {
        hook.cleanup();
      } catch (err) {
        instance.runtime.onError(err, `cleanup in <${instance.component}>`);
      }
    }
  }
  instance.hooks = [];

  for (const sub of instance.subscriptions) sub.dispose();
  instance.subscriptions = [];
  instance.mounted = false;
}

/** Re-resolve props and note which store paths this instance now depends on. */
export function updateProps(instance: Instance, node: ComponentNode): void {
  const ctx = resolveContextFor(instance);
  const nextContext = node.dataContext;
  if (typeof nextContext === 'string') {
    instance.dataContext = nextContext as BindingPath;
    ctx.dataContext = instance.dataContext;
  }

  instance.node = node;
  instance.props = resolveProps(ctx, node);

  // Children that are a templated list read their source path too.
  const children = instance.props.children;
  if (isTemplateChildren(children)) {
    const expanded = expandTemplate(instance.runtime, children, instance.dataContext);
    ctx.reads.add(expanded.read);
  }

  instance.reads = ctx.reads;
}

export function findFunction(
  runtime: Runtime,
  node: ComponentNode,
): { kind: InstanceKind; fn?: FunctionComponent; host?: HostComponent; definition?: ComponentDefinition } {
  const inline = nodeFunction(node);
  if (inline) return { kind: 'function', fn: inline };

  const def = runtime.components.get(node.component);
  if (!def) return { kind: 'missing' };

  switch (def.renderer.kind) {
    case 'function':
      return { kind: 'function', fn: def.renderer.render, definition: def };
    case 'host':
      return { kind: 'host', host: def.renderer.host, definition: def };
    case 'template':
      return { kind: 'template', definition: def };
    case 'lazy':
      // Not resolved yet; the registry resolves it and asks for another frame.
      return { kind: 'missing', definition: def };
  }
}

/**
 * Mark an instance for re-render, and tell its ancestors a descendant changed
 * so the render pass will walk down to it.
 */
export function markDirty(instance: Instance, reason: string): void {
  instance.dirty = true;
  instance.renderReason = reason;
  let cursor = instance.parent;
  while (cursor && !cursor.childDirty) {
    cursor.childDirty = true;
    cursor = cursor.parent;
  }
}
