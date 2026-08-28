import type {
  Action, BindingPath, ComponentNode, DataBinding, FunctionCall,
} from '../types/graph.js';
import type { ReactiveStore } from '../types/store.js';
import { isAction, isComponentNode, isDataBinding, isFunctionCall } from '../types/graph.js';
import { resolvePath } from '../util/paths.js';

/**
 * Prop values arrive as literals, bindings (`{ path }`) or function calls
 * (`{ call }`). Resolving them is what makes a node written as data behave
 * exactly like one written in JSX.
 *
 * Every path read during a resolve is recorded, so the caller can subscribe to
 * precisely the paths this subtree depends on and re-render on nothing else.
 */
export interface ResolveContext {
  store: ReactiveStore;
  /** Relative paths resolve against this. */
  dataContext?: BindingPath;
  /** Run a registered command. */
  execute(id: string, args?: Record<string, unknown>): unknown;
  /** Publish on an event path. */
  emit(path: string, payload?: unknown): void;
  /** Collected during the resolve; the caller subscribes to these. */
  reads: Set<string>;
}

/** `#/a/b` means: the value AT this path is itself a path. One extra hop. */
function readPath(ctx: ResolveContext, raw: string): unknown {
  let path = raw;

  // `{{ /other/path }}` substitutes another path's value into this one first.
  if (path.includes('{{')) {
    path = path.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_m, inner: string) => {
      const resolved = resolvePath(inner.trim(), ctx.dataContext);
      ctx.reads.add(resolved);
      return String(ctx.store.get(resolved) ?? '');
    });
  }

  if (path.startsWith('#/')) {
    const indirect = resolvePath(path.slice(1), ctx.dataContext);
    ctx.reads.add(indirect);
    const target = ctx.store.get(indirect);
    if (typeof target !== 'string') return undefined;
    const final = resolvePath(target, ctx.dataContext);
    ctx.reads.add(final);
    return ctx.store.get(final);
  }

  const resolved = resolvePath(path, ctx.dataContext);
  ctx.reads.add(resolved);
  return ctx.store.get(resolved);
}

function resolveCall(ctx: ResolveContext, call: FunctionCall): unknown {
  const args: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(call.args ?? {})) {
    args[k] = resolveValue(ctx, v);
  }
  return ctx.execute(call.call, args);
}

/**
 * Turn an action into something callable. Actions stay data right up to the
 * moment they are invoked, which is what lets the same button work whether it
 * was written in JSX with a closure or loaded from JSON naming a command.
 */
export function resolveAction(
  ctx: ResolveContext,
  action: Action | ((...args: unknown[]) => unknown) | undefined,
): ((...args: unknown[]) => unknown) | undefined {
  if (action === undefined) return undefined;
  if (typeof action === 'function') return action;
  if ('handler' in action) return action.handler as (...args: unknown[]) => unknown;
  if ('functionCall' in action) {
    return () => resolveCall(ctx, action.functionCall);
  }
  if ('emit' in action) {
    return () => ctx.emit(action.emit.path, resolveValue(ctx, action.emit.payload));
  }
  return undefined;
}

/** Resolve one prop value, leaving nodes and closures alone. */
export function resolveValue(ctx: ResolveContext, value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  if (typeof value === 'function') return value;

  if (isDataBinding(value)) return readPath(ctx, (value as DataBinding).path);
  if (isFunctionCall(value)) return resolveCall(ctx, value as FunctionCall);
  // Nodes and templated child lists stay as they are; the reconciler owns them.
  if (isComponentNode(value)) return value;
  if (isAction(value)) return value;

  /*
   * The same array back when there was nothing in it to resolve.
   *
   * Identity is what the reconciler compares - a component whose props are
   * all unchanged is not re-run, and neither is anything under it - so
   * copying unconditionally made that test impossible to pass for exactly
   * the props worth passing it for. A list of four hundred rows arrived as a
   * new array on every pass, its holder re-rendered every frame whatever it
   * had been told, and the memoisation callers wrote to prevent that could
   * not reach this far.
   *
   * Copying at all is for the bindings: a `{ path }` inside an array has to
   * become the value it names, and that is a different array. So the copy is
   * kept and returned only when something in it actually changed.
   */
  if (Array.isArray(value)) {
    let changed = false;
    const items = value.map((v) => {
      const resolved = resolveValue(ctx, v);
      if (resolved !== v) changed = true;
      return resolved;
    });
    return changed ? items : value;
  }

  let changed = false;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const resolved = resolveValue(ctx, v);
    if (resolved !== v) changed = true;
    out[k] = resolved;
  }
  return changed ? out : value;
}

/**
 * Resolve every prop on a node. `component`, `id`, `key` and `$meta` are
 * structural and pass through untouched.
 *
 * A prop named `onSomething` whose value is an action becomes a callable, so a
 * node loaded from JSON can say `{ onPress: { functionCall: { call: 'x' } } }`
 * and the component receives the same shape it would get from JSX. Without
 * this, actions-as-data would only work on the handful of props the runtime
 * knew about by name.
 */
export function resolveProps(
  ctx: ResolveContext,
  node: ComponentNode,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === 'component' || k === '$meta' || k === 'key') continue;
    if (k === 'children') {
      out.children = v;
      continue;
    }
    if (isHandlerProp(k) && isAction(v)) {
      out[k] = resolveAction(ctx, v);
      continue;
    }
    out[k] = resolveValue(ctx, v);
  }
  return out;
}

/** `onPress`, `onSelect`, `onChange` - but not `once` or `only`. */
function isHandlerProp(key: string): boolean {
  return key.length > 2 && key.startsWith('on') && key[2] === key[2]?.toUpperCase();
}

/** True when the value is a templated child list: one instance per item. */
export function isTemplateChildren(
  v: unknown,
): v is { template: ComponentNode; path: BindingPath } {
  return (
    typeof v === 'object' && v !== null &&
    'template' in v && 'path' in v &&
    isComponentNode((v as { template: unknown }).template)
  );
}
