import type { BindingPath, ComponentNode, ErrorFallback, RenderError } from '../types/graph.js';
import type { Runtime } from './runtime.js';
import type { Instance } from './instance.js';
import {
  createInstance, expandTemplate, findFunction, markDirty, normalizeChildren,
  unmountInstance, updateProps, walkInstances,
} from './instance.js';
import { isTemplateChildren } from './bindings.js';
import { setCurrentInstance } from './hooks.js';

/**
 * The render pass: a node graph in, a retained instance tree out.
 *
 * Two things make this cheap enough to run per frame. Instances are matched by
 * key and component name, so an unchanged subtree keeps its hooks and its
 * layout. And an instance is only re-rendered when something marked it dirty -
 * its own state, a store path it read, or its parent handing it new props.
 */

export interface RenderOptions {
  /** Re-render everything, ignoring dirty flags. After a theme change. */
  force?: boolean;
  /** Record why each instance rendered. */
  diagnostics?: boolean;
}

const MAX_DEPTH = 200;

export function renderTree(
  runtime: Runtime,
  root: Instance | null,
  node: ComponentNode,
  options: RenderOptions = {},
): Instance {
  const instance = reconcile(runtime, null, root ?? undefined, node, options, 0, undefined);
  return instance;
}

/** Match by component name and key; anything else is a fresh mount. */
function canReuse(existing: Instance | undefined, node: ComponentNode): existing is Instance {
  if (!existing) return false;
  if (existing.component !== node.component) return false;
  return existing.key === node.key;
}

export function reconcile(
  runtime: Runtime,
  parent: Instance | null,
  existing: Instance | undefined,
  node: ComponentNode,
  options: RenderOptions,
  depth: number,
  dataContext: BindingPath | undefined,
): Instance {
  if (depth > MAX_DEPTH) {
    throw new Error(
      `[textui] component tree exceeded ${MAX_DEPTH} levels at <${node.component}> - ` +
      'a component is almost certainly rendering itself',
    );
  }

  let instance: Instance;
  if (canReuse(existing, node)) {
    instance = existing;
    instance.parent = parent;
  } else {
    if (existing) unmountInstance(existing);
    instance = createInstance(runtime, node, parent);
  }

  // The data context has to be in place before props resolve, or a relative
  // path in a templated row has nothing to resolve against.
  instance.dataContext = dataContext ?? parent?.dataContext;

  const resolved = findFunction(runtime, node);
  instance.kind = resolved.kind;
  instance.fn = resolved.fn;
  instance.host = resolved.host;
  instance.definition = resolved.definition;

  const previousProps = instance.props;
  updateProps(instance, node);

  const propsChanged = !shallowEqual(previousProps, instance.props);
  const mustRender = options.force || instance.dirty || !instance.mounted || propsChanged;

  if (!mustRender) {
    // Clean itself, but something below changed: reconcile the children it
    // produced last time rather than re-running this component.
    if (instance.childDirty) {
      instance.childDirty = false;
      reconcileChildren(runtime, instance, instance.lastChildren, options, depth);
    }
    return instance;
  }

  if (options.diagnostics && !instance.renderReason) {
    instance.renderReason = !instance.mounted ? 'mount' : propsChanged ? 'props' : 'dirty';
  }

  instance.dirty = false;
  instance.childDirty = false;
  instance.mounted = true;
  instance.error = undefined;

  subscribeToReads(instance);

  const childNodes = renderToNodes(runtime, instance, options);
  instance.lastChildren = childNodes;
  reconcileChildren(runtime, instance, childNodes, options, depth);

  if (!options.diagnostics) instance.renderReason = undefined;
  return instance;
}

/** Produce this instance's child nodes, whatever kind it is. */
function renderToNodes(
  runtime: Runtime,
  instance: Instance,
  options: RenderOptions,
): { node: ComponentNode; dataContext?: BindingPath }[] {
  const childrenProp = instance.props.children;

  const wrap = (nodes: ComponentNode[]): { node: ComponentNode }[] =>
    nodes.map((node) => ({ node }));

  switch (instance.kind) {
    case 'function': {
      const fn = instance.fn;
      if (!fn) return [];
      setCurrentInstance(instance);
      try {
        const output = fn(instance.props);
        return wrap(normalizeChildren(output));
      } catch (err) {
        instance.error = err;
        runtime.onError(err, `render of <${instance.component}>`);
        return wrap(normalizeChildren(fallbackFor(instance, err)));
      } finally {
        setCurrentInstance(null);
      }
    }

    case 'template': {
      const template = instance.definition?.renderer.kind === 'template'
        ? instance.definition.renderer.template
        : null;
      if (!template) return [];
      // The template receives this node's props as its data context.
      return wrap([{ ...template, ...stripStructural(instance.props) }]);
    }

    case 'host': {
      if (isTemplateChildren(childrenProp)) {
        const expanded = expandTemplate(runtime, childrenProp, instance.dataContext);
        return expanded.nodes.map((node, i) => ({
          node,
          dataContext: expanded.contexts[i],
        }));
      }
      return wrap(normalizeChildren(childrenProp));
    }

    case 'missing': {
      resolveLazy(runtime, instance);
      return wrap(normalizeChildren(missingNode(instance, options)));
    }
  }
}

function stripStructural(props: Record<string, unknown>): Record<string, unknown> {
  const { children: _children, ...rest } = props;
  return rest;
}

/** A lazily-registered component resolves in the background and re-renders. */
function resolveLazy(runtime: Runtime, instance: Instance): void {
  const def = instance.definition;
  if (!def || def.renderer.kind !== 'lazy') return;
  void runtime.components
    .resolve(instance.component)
    .then(() => {
      markDirty(instance, 'lazy component resolved');
      runtime.requestRender();
    })
    .catch((err: unknown) => runtime.onError(err, `resolving <${instance.component}>`));
}

/**
 * A name that was never registered is a runtime miss, not a compile error -
 * that is the price of the graph being data, so the miss has to be visible
 * rather than silent.
 */
function missingNode(instance: Instance, options: RenderOptions): ComponentNode {
  if (instance.definition?.renderer.kind === 'lazy') {
    return { component: 'text', content: '', dim: true };
  }
  const fallback = instance.node.$meta?.fallback;
  if (fallback) {
    // A miss is not a throw, but it is the same question - what does this
    // render instead - so a fallback answers both.
    const message = `no component registered as "${instance.component}"`;
    return applyFallback(fallback, {
      error: new Error(message), message, component: instance.component,
    });
  }
  return {
    component: 'text',
    content: options.diagnostics
      ? `<${instance.component}?>`
      : `<${instance.component}>`,
    fg: 'danger',
  };
}

/**
 * Render a declared fallback.
 *
 * A function fallback is handed the failure. A node fallback is handed it as
 * the `error` and `errorMessage` props, so the graph stays data and a
 * registered component can render the failure without the registry holding a
 * function. Props the fallback declares itself win.
 */
function applyFallback(fallback: ErrorFallback, failure: RenderError): ComponentNode {
  if (typeof fallback === 'function') return fallback(failure);
  return { error: failure.error, errorMessage: failure.message, ...fallback };
}

function fallbackFor(instance: Instance, err: unknown): ComponentNode {
  const fallback = instance.node.$meta?.fallback ?? instance.definition?.fallback;
  const message = err instanceof Error ? err.message : String(err);
  if (fallback) {
    return applyFallback(fallback, { error: err, message, component: instance.component });
  }

  return {
    component: 'text',
    content: `${instance.component}: ${message}`,
    fg: 'danger',
    wrap: 'word',
  };
}

/**
 * Subscribe to exactly the store paths this instance's props read. Nothing
 * else re-renders it, which is what keeps a hundred-row list from re-rendering
 * because an unrelated counter moved.
 */
function subscribeToReads(instance: Instance): void {
  for (const sub of instance.subscriptions) sub.dispose();
  instance.subscriptions = [];

  if (instance.reads.size === 0) return;

  for (const path of instance.reads) {
    instance.subscriptions.push(
      instance.runtime.store.subscribe(path as BindingPath, () => {
        markDirty(instance, `store ${path}`);
        instance.runtime.requestRender();
      }),
    );
  }
}

function reconcileChildren(
  runtime: Runtime,
  instance: Instance,
  childNodes: { node: ComponentNode; dataContext?: BindingPath }[],
  options: RenderOptions,
  depth: number,
): void {
  const previous = instance.children;
  const byKey = new Map<string | number, Instance>();
  for (let i = 0; i < previous.length; i++) {
    const child = previous[i] as Instance;
    byKey.set(child.key ?? `__index_${i}`, child);
  }

  const next: Instance[] = [];
  const used = new Set<Instance>();

  for (let i = 0; i < childNodes.length; i++) {
    const entry = childNodes[i] as { node: ComponentNode; dataContext?: BindingPath };
    const key = entry.node.key ?? `__index_${i}`;
    const candidate = byKey.get(key);
    const reusable = candidate && !used.has(candidate) ? candidate : undefined;

    const child = reconcile(
      runtime, instance, reusable, entry.node, options, depth + 1,
      entry.dataContext ?? instance.dataContext,
    );

    if (reusable) used.add(reusable);
    next.push(child);
  }

  for (const child of previous) {
    if (!used.has(child) && !next.includes(child)) unmountInstance(child);
  }

  instance.children = next;
}

function shallowEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (!Object.is(a[key], b[key])) return false;
  }
  return true;
}

/** Every effect queued during the last render, parents last. */
export function collectEffects(root: Instance): (() => void)[] {
  const effects: (() => void)[] = [];
  walkInstances(root, (instance) => {
    if (instance.pendingEffects.length === 0) return;
    effects.push(...instance.pendingEffects);
    instance.pendingEffects = [];
  });
  return effects;
}

export function disposeTree(root: Instance): void {
  unmountInstance(root);
}
