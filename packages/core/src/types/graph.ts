/**
 * The component graph.
 *
 * A screen IS its root ComponentNode. JSX compiles to exactly this shape -
 * `<Row gap={1}/>` and `{ component: 'Row', gap: 1 }` are the same value - so
 * a screen can be written in TypeScript, loaded from JSON, generated, edited
 * or sent over a wire without changing the runtime that mounts it.
 *
 * Three keys are reserved on every node: `id`, `component`, `$meta`.
 * Everything else is props, and props are the component's business.
 */
export type NodeId = string;

/**
 * JSON-Pointer-shaped store path.
 *
 * `$/seg/seg` - absolute; the first segment is a scope.
 * `/seg/seg`  - relative to the surrounding data context.
 * `..`        - forbidden. Escape to the root with `$/` instead, so a node's
 *               meaning never depends on where it was pasted.
 * `*`         - wildcard segment, subscriptions only (writes throw).
 * `#/seg`     - the value AT this path is itself a path; one extra hop.
 * `{{ /seg }}` inside a path substitutes another path's value first.
 */
export type BindingPath = `$/${string}` | `/${string}`;

/**
 * Transient event path. Same shape, different lifetime: events are delivered
 * and forgotten, never stored. `@/dialog/confirm`, `@/agent/restart`.
 */
export type EventPath = `@/${string}`;

export type DataBinding = { path: BindingPath };

export type FunctionCall = {
  call: string;
  args?: Record<string, PropValue>;
  /** Refuse to route this to a remote dispatcher. */
  callableFrom?: 'clientOnly';
};

export type DynamicValue =
  | string | number | boolean | string[]
  | DataBinding | FunctionCall;

export type DynamicString = string | DataBinding | FunctionCall;
export type DynamicNumber = number | DataBinding | FunctionCall;
export type DynamicBoolean = boolean | DataBinding | FunctionCall;
export type DynamicStringList = string[] | DataBinding | FunctionCall;

/** Inline children, or one instance of `template` per item at `path`. */
export type ChildList =
  | ComponentNode[]
  | { template: ComponentNode; path: BindingPath };

/**
 * Discriminated by key presence:
 *   'emit' in action         -> publish on an event path
 *   'functionCall' in action -> run a registered command
 *   'handler' in action      -> a closure. Never serializable; only legal for
 *                               nodes built in-process (JSX), and stripped
 *                               when a graph is exported.
 */
export type Action =
  | { emit: { path: EventPath; payload?: PropValue; } }
  | { functionCall: FunctionCall }
  | { handler: (...args: any[]) => void };

export type PropValue =
  | string | number | boolean | null | undefined
  | DataBinding
  | FunctionCall
  | Action
  | ComponentNode
  | ComponentNode[]
  | { template: ComponentNode; path: BindingPath }
  | { [k: string]: PropValue }
  | PropValue[]
  | ((...args: any[]) => unknown);

/** What a component threw, and which component threw it. */
export interface RenderError {
  /** The thrown value, whatever it was. */
  error: unknown;
  /** `error.message`, or the value stringified. */
  message: string;
  /** The component that threw. */
  component: string;
}

/**
 * What to render when a component throws.
 *
 * A node keeps the graph data, and is handed the failure as the `error` and
 * `errorMessage` props - so a registered `ErrorPanel` can show what happened
 * without the registry holding a function. A function is for the local case,
 * where the fallback wants the failure itself rather than two props.
 */
export type ErrorFallback =
  | ComponentNode
  | ((failure: RenderError) => ComponentNode);

/** Internal only - stripped before a node is serialized back to a sender. */
export type NodeMeta = {
  origin?: { format: string; version?: string; sourceNodeId?: NodeId };
  /** Rendered instead when this node's subtree throws. */
  fallback?: ErrorFallback;
  /** Set by the JSX factory for a function component, so the registry can
   *  resolve the same function without a name collision. */
  fn?: unknown;
  /** Source location, when the JSX transform provides one. */
  source?: { file: string; line: number; column: number };
};

export type ComponentNode = {
  id?: NodeId;
  component: string;
  $meta?: NodeMeta;
  /** Reconciliation identity among siblings. */
  key?: string | number;
  children?: PropValue | unknown;
  [prop: string]: unknown;
};

/** A screen IS its root node. No separate {root, nodes} map. */
export type ScreenState = ComponentNode;

export function isComponentNode(v: unknown): v is ComponentNode {
  return (
    typeof v === 'object' && v !== null &&
    'component' in v && typeof (v as ComponentNode).component === 'string'
  );
}

export function isDataBinding(v: unknown): v is DataBinding {
  return (
    typeof v === 'object' && v !== null &&
    'path' in v && typeof (v as DataBinding).path === 'string' &&
    !('component' in v) && !('template' in v)
  );
}

export function isFunctionCall(v: unknown): v is FunctionCall {
  return (
    typeof v === 'object' && v !== null &&
    'call' in v && typeof (v as FunctionCall).call === 'string' &&
    !('component' in v)
  );
}

export function isAction(v: unknown): v is Action {
  return (
    typeof v === 'object' && v !== null &&
    ('emit' in v || 'functionCall' in v || 'handler' in v) &&
    !('component' in v)
  );
}

export function isTemplatedChildren(
  v: unknown,
): v is { template: ComponentNode; path: BindingPath } {
  return (
    typeof v === 'object' && v !== null &&
    'template' in v && 'path' in v &&
    isComponentNode((v as { template: unknown }).template)
  );
}
