import type {
  FocusableOptions, FocusDirection, FocusManager, FocusScopeOptions,
} from '../types/focus.js';
import type { KeyEvent } from '../types/input.js';
import type { Rect } from '../types/geometry.js';
import type { Disposable } from '../types/disposable.js';
import { toDisposable } from '../util/disposable.js';
import { rectContains } from '../types/geometry.js';

interface Scope extends FocusScopeOptions {
  /** What was focused when this scope activated, for `restore`. */
  restoreTo: string | null;
}

/** The scope every global handler lives in, always active and always last. */
export const GLOBAL_SCOPE = '__global__';

/**
 * Focus.
 *
 * Tab order is registration order within a scope unless a node states one.
 * Directional navigation is geometric, because in a terminal "the thing to the
 * right" is a real question a table, a menu and a dashboard all ask, and none
 * of them can answer it from document order.
 */
export class Focus implements FocusManager {
  private scopes = new Map<string, Scope>();
  private nodes = new Map<string, FocusableOptions>();
  /** Registration order, which is tab order when nothing states otherwise. */
  private order_: string[] = [];
  private stack: string[] = [];
  private current: string | null = null;

  constructor(private onChange: () => void = () => {}) {
    this.scopes.set(GLOBAL_SCOPE, { id: GLOBAL_SCOPE, priority: -1, restoreTo: null });
    this.stack.push(GLOBAL_SCOPE);
  }

  // ------------------------------------------------------------- scopes

  registerScope(options: FocusScopeOptions): Disposable {
    this.scopes.set(options.id, { ...options, restoreTo: null });
    return toDisposable(() => {
      this.deactivateScope(options.id);
      this.scopes.delete(options.id);
    });
  }

  activateScope(id: string): void {
    const scope = this.scopes.get(id);
    if (!scope) return;
    if (this.stack.includes(id)) return;

    scope.restoreTo = this.current;
    this.stack.push(id);

    if (scope.autoFocus) {
      const first = this.order(id)[0];
      if (first) this.focus(first);
    }
    this.onChange();
  }

  deactivateScope(id: string): void {
    const index = this.stack.indexOf(id);
    if (index <= 0) return;
    const scope = this.scopes.get(id);
    this.stack.splice(index, 1);

    // A scope closing may only move focus it was holding. Blurring regardless
    // took focus off whatever was driving the change - a sidebar that swaps
    // the screen beside it lost focus on every arrow press, and the incoming
    // screen then claimed it, so the sidebar could be moved exactly once.
    // "Nothing holds focus" counts as held: a scope closing takes its own
    // contents with it, so by the time this runs the thing it had focused has
    // usually already unmounted. What must not count is focus sitting on
    // something *outside* - that belongs to whoever put it there.
    const held = this.current === null || this.scopeOf(this.current) === id;

    if (scope?.restore && held) {
      const target = scope.restoreTo;
      scope.restoreTo = null;
      if (target && this.nodes.has(target)) {
        this.focus(target);
        return;
      }
      this.blur();
    } else if (scope?.restore) {
      scope.restoreTo = null;
    } else if (held) {
      this.blur();
    }
    this.onChange();
  }

  activeScope(): string | null {
    const top = this.stack[this.stack.length - 1];
    return top === GLOBAL_SCOPE ? null : top ?? null;
  }

  /** The innermost active scope that traps, if any. */
  private trappingScope(): string | null {
    for (let i = this.stack.length - 1; i >= 0; i--) {
      const id = this.stack[i] as string;
      if (this.scopes.get(id)?.trap) return id;
    }
    return null;
  }

  /** Which scope a focusable belongs to. `GLOBAL_SCOPE` when it names none. */
  scopeOf(nodeId: string): string {
    return this.nodes.get(nodeId)?.scopeId ?? GLOBAL_SCOPE;
  }

  // ---------------------------------------------------------- focusables

  register(options: FocusableOptions): Disposable {
    const existing = this.nodes.has(options.id);
    this.nodes.set(options.id, options);
    if (!existing) this.order_.push(options.id);

    // A scope that asked to take focus takes it here, as its first control
    // arrives - not when it was activated, because a scope is empty then. Its
    // contents register on the way up, one effect at a time, and effects run
    // parent-first, so `autoFocus` at activation could only ever have found
    // something in a scope that already had something in it.
    //
    // Only when *nothing at all* holds focus. That is the difference between
    // the screen this is for - pushed over whatever had focus, which the push
    // unmounted, leaving none - and a dialog, which opens while its opener
    // still holds focus and whose own controls say which of them wants it.
    if (!existing && options.disabled !== true && this.current === null) {
      const scopeId = options.scopeId ?? GLOBAL_SCOPE;
      if (this.scopes.get(scopeId)?.autoFocus === true && this.stack.includes(scopeId)) {
        this.focus(options.id);
      }
    }

    return toDisposable(() => {
      this.nodes.delete(options.id);
      const i = this.order_.indexOf(options.id);
      if (i >= 0) this.order_.splice(i, 1);
      if (this.current === options.id) {
        this.current = null;
        this.onChange();
      }
    });
  }

  update(id: string, patch: Partial<FocusableOptions>): void {
    const node = this.nodes.get(id);
    if (!node) return;
    this.nodes.set(id, { ...node, ...patch });
  }

  has(id: string): boolean {
    return this.nodes.has(id);
  }

  focus(id: string): boolean {
    const node = this.nodes.get(id);
    if (!node || node.disabled) return false;
    if (this.current === id) return true;

    const previous = this.current ? this.nodes.get(this.current) : undefined;
    this.current = id;
    previous?.onBlur?.();
    node.onFocus?.();
    this.onChange();
    return true;
  }

  blur(): void {
    if (!this.current) return;
    const node = this.nodes.get(this.current);
    this.current = null;
    node?.onBlur?.();
    this.onChange();
  }

  focused(): string | null {
    return this.current;
  }

  chain(): string[] {
    const out: string[] = [];
    if (this.current) out.push(this.current);
    for (let i = this.stack.length - 1; i >= 0; i--) out.push(this.stack[i] as string);
    return out;
  }

  /** Tab order: explicit `order` first, then registration order. */
  order(scopeId?: string): string[] {
    const trap = this.trappingScope();
    const scope = scopeId ?? trap ?? undefined;

    const candidates = this.order_
      .map((id) => this.nodes.get(id))
      .filter((n): n is FocusableOptions => {
        if (!n || n.disabled || n.skipTab) return false;
        if (scope === undefined) return true;
        return (n.scopeId ?? GLOBAL_SCOPE) === scope;
      });

    return candidates
      .map((n, i) => ({ n, i }))
      .sort((a, b) => {
        const ao = a.n.order ?? Number.MAX_SAFE_INTEGER;
        const bo = b.n.order ?? Number.MAX_SAFE_INTEGER;
        return ao === bo ? a.i - b.i : ao - bo;
      })
      .map((e) => e.n.id);
  }

  move(direction: FocusDirection): string | null {
    if (direction === 'next' || direction === 'previous') {
      const list = this.order();
      if (list.length === 0) return null;
      const index = this.current ? list.indexOf(this.current) : -1;
      const step = direction === 'next' ? 1 : -1;
      const nextIndex = index === -1
        ? (direction === 'next' ? 0 : list.length - 1)
        : (index + step + list.length) % list.length;
      const id = list[nextIndex] as string;
      return this.focus(id) ? id : null;
    }
    return this.moveDirectional(direction);
  }

  /**
   * Geometric navigation. Candidates must lie in the requested direction; the
   * winner is the nearest, with distance along the axis weighted more heavily
   * than drift across it, so `right` from a table cell finds the next column
   * rather than a distant button that happens to be closer in a straight line.
   */
  private moveDirectional(direction: 'up' | 'down' | 'left' | 'right'): string | null {
    const from = this.current ? this.nodes.get(this.current) : undefined;
    const origin = from?.rect;
    if (!origin) {
      const first = this.order()[0];
      return first && this.focus(first) ? first : null;
    }

    const trap = this.trappingScope();
    const cx = origin.x + origin.width / 2;
    const cy = origin.y + origin.height / 2;

    let best: { id: string; score: number } | null = null;

    for (const node of this.nodes.values()) {
      if (node.id === from.id || node.disabled || !node.rect) continue;
      if (trap && (node.scopeId ?? GLOBAL_SCOPE) !== trap) continue;

      const r = node.rect;
      const nx = r.x + r.width / 2;
      const ny = r.y + r.height / 2;
      const dx = nx - cx;
      const dy = ny - cy;

      const along = direction === 'left' ? -dx : direction === 'right' ? dx
        : direction === 'up' ? -dy : dy;
      if (along <= 0) continue;

      const across = direction === 'left' || direction === 'right'
        ? Math.abs(dy)
        : Math.abs(dx);

      const score = along + across * 3;
      if (!best || score < best.score) best = { id: node.id, score };
    }

    if (!best) return null;
    return this.focus(best.id) ? best.id : null;
  }

  at(x: number, y: number): string | null {
    let found: string | null = null;
    let smallest = Infinity;
    for (const node of this.nodes.values()) {
      if (node.disabled || !node.rect) continue;
      if (!rectContains(node.rect as Rect, x, y)) continue;
      // The innermost hit wins, and "innermost" is the smallest area.
      const area = node.rect.width * node.rect.height;
      if (area < smallest) {
        smallest = area;
        found = node.id;
      }
    }
    return found;
  }

  /**
   * Focused node first, then outward through active scopes, then global -
   * except that a trap stops the walk at itself.
   *
   * `order` and `move` already honoured the trap, so tab could not leave a
   * modal; keys could, and did. A menu bar whose labels live in the global
   * scope kept receiving every arrow while its own dropdown was open, so down
   * re-opened the menu instead of moving inside it, and a palette opened over
   * the top inherited the same problem - two layers reading one keystroke, and
   * two escapes needed to get out.
   *
   * A trap owns the keyboard. Nothing outside it is a target, including a
   * focused node left over from before it opened.
   */
  dispatch(event: KeyEvent): boolean {
    const trap = this.trappingScope();
    const inTrap = (node: { scopeId?: string }): boolean =>
      trap === null || (node.scopeId ?? GLOBAL_SCOPE) === trap;

    if (this.current) {
      const node = this.nodes.get(this.current);
      if (node && inTrap(node) && (node.onKey?.(event) === true || event.handled)) return true;
    }

    for (let i = this.stack.length - 1; i >= 0; i--) {
      const scopeId = this.stack[i] as string;
      if (trap !== null && scopeId !== trap) continue;
      for (const node of this.nodes.values()) {
        if (node.id === this.current) continue;
        if ((node.scopeId ?? GLOBAL_SCOPE) !== scopeId) continue;
        if (!node.onKey) continue;
        if (node.onKey(event) === true || event.handled) return true;
      }
    }
    return false;
  }

  /** Called by the renderer after layout, so hit-testing has real rects. */
  setRect(id: string, rect: Rect): void {
    const node = this.nodes.get(id);
    if (node) node.rect = rect;
  }
}

export function createFocus(onChange?: () => void): Focus {
  return new Focus(onChange);
}
