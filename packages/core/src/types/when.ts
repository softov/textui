import type { BindingPath } from './graph.js';

export type ContextValue = string | number | boolean | null;

/**
 * A small expression over store paths and context keys. Chrome that should not
 * exist for this user does not mount, rather than mounting disabled.
 *
 *   "$/session/role == 'admin'"
 *   "$/modus/capabilities/mouse && !$/ui/sidebar/collapsed"
 *   "$/modus/size/width >= 100"
 */
export type WhenClause = string;

export interface WhenEngine {
  evaluate(clause: WhenClause | undefined, extra?: Record<string, ContextValue>): boolean;
  /** Paths a clause reads, so a caller can subscribe to exactly those. */
  dependencies(clause: WhenClause): BindingPath[];
  setContext(key: string, value: ContextValue): void;
  getContext(key: string): ContextValue | undefined;
}
