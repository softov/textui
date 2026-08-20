import type { Disposable } from './disposable.js';
import type { Rect } from './geometry.js';
import type { KeyEvent } from './input.js';

export type FocusDirection = 'next' | 'previous' | 'up' | 'down' | 'left' | 'right';

/**
 * A focus scope is a container that focus can be trapped inside or restored
 * to. Modals trap; a sidebar does not. Scopes nest, and the innermost active
 * scope answers navigation first.
 */
export interface FocusScopeOptions {
  id: string;
  /** Tab cannot leave this scope while it is active. Modals want this. */
  trap?: boolean;
  /** Restore focus to whatever was focused before, on deactivate. */
  restore?: boolean;
  /** Focus this scope's first focusable as soon as it activates. */
  autoFocus?: boolean;
  /** Higher wins when two scopes are active. */
  priority?: number;
}

export interface FocusableOptions {
  id: string;
  /** Explicit order within the scope. Unset = document order. */
  order?: number;
  disabled?: boolean;
  /** Skipped by tab, still reachable by directional navigation and click. */
  skipTab?: boolean;
  /** Current bounds, for directional navigation and mouse hit-testing. */
  rect?: Rect;
  scopeId?: string;
  onFocus?(): void;
  onBlur?(): void;
  /** Return true to consume. Runs before the scope's and the app's handlers. */
  onKey?(event: KeyEvent): boolean | void;
}

export interface FocusManager {
  registerScope(options: FocusScopeOptions): Disposable;
  activateScope(id: string): void;
  deactivateScope(id: string): void;
  activeScope(): string | null;

  register(options: FocusableOptions): Disposable;
  update(id: string, patch: Partial<FocusableOptions>): void;

  /** True when a focusable with this id is registered. */
  has(id: string): boolean;
  /** Which scope a focusable belongs to. */
  scopeOf(id: string): string;
  focus(id: string): boolean;
  blur(): void;
  focused(): string | null;
  /** Move focus; returns the id that took it. */
  move(direction: FocusDirection): string | null;
  /** The focused id and every ancestor scope, innermost first. */
  chain(): string[];
  /** Ids in tab order within a scope (or the active scope). */
  order(scopeId?: string): string[];
  /** Hit-test a cell; used for click-to-focus. */
  at(x: number, y: number): string | null;
  /**
   * Feed a key to the focused node, then outward through its scopes, then to
   * global handlers. Returns true when something consumed it.
   */
  dispatch(event: KeyEvent): boolean;
}
