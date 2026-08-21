import type { Navigator, ScreenDefinition, ScreenEntry } from '../types/navigation.js';
import type { ReactiveStore } from '../types/store.js';
import type { FocusManager } from '../types/focus.js';
import type { Disposable } from '../types/disposable.js';
import { toDisposable } from '../util/disposable.js';

/**
 * Screens and a stack, not a router.
 *
 * The whole navigation model is "what is on top", plus enough memory to put
 * focus back where it was when you return. An application that wants URLs maps
 * them onto screens itself; nothing here assumes a browser exists.
 */
export class Navigation implements Navigator {
  private defs = new Map<string, ScreenDefinition>();
  private entries: ScreenEntry[] = [];

  constructor(
    private deps: {
      store: ReactiveStore;
      focus: FocusManager;
      onChange(): void;
      /**
       * Put the current screen on screen.
       *
       * A callback rather than a surface registry, because what a screen *is*
       * - a stack entry and a definition - has nothing to do with where the
       * application decided to draw it.
       */
      mount(entry: ScreenEntry | null): void;
    },
  ) {}

  register(screen: ScreenDefinition): Disposable {
    this.defs.set(screen.id, screen);
    return toDisposable(() => this.defs.delete(screen.id));
  }

  screens(): ScreenDefinition[] {
    return [...this.defs.values()];
  }

  get(id: string): ScreenDefinition | undefined {
    return this.defs.get(id);
  }

  private publish(): void {
    const current = this.current();
    this.deps.store.set('$/layout/screen/stack', this.entries.map((e) => e.id));
    this.deps.store.set('$/layout/screen/current', current?.id ?? null);
    // Published as well as passed as props, so a component deep inside a
    // screen can read the parameters without every layer between forwarding
    // them.
    this.deps.store.set('$/layout/screen/params', current?.params ?? {});
    this.deps.mount(current);
    this.deps.onChange();
  }

  /** Remember where focus was, so `pop` can put it back. */
  private snapshotFocus(): void {
    const top = this.entries[this.entries.length - 1];
    if (top) top.restoreFocus = this.deps.focus.focused();
  }

  push(id: string, params?: Record<string, unknown>): void {
    if (!this.defs.has(id)) {
      throw new Error(`[textui] no screen registered as "${id}"`);
    }
    this.snapshotFocus();
    this.entries.push({ id, params });
    this.publish();
  }

  replace(id: string, params?: Record<string, unknown>): void {
    if (!this.defs.has(id)) {
      throw new Error(`[textui] no screen registered as "${id}"`);
    }
    const previous = this.entries.pop();
    this.clearScreenScope(previous);
    this.entries.push({ id, params });
    this.publish();
  }

  pop(): boolean {
    if (this.entries.length <= 1) return false;
    const previous = this.entries.pop();
    this.clearScreenScope(previous);

    const top = this.entries[this.entries.length - 1];
    if (top?.restoreFocus) this.deps.focus.focus(top.restoreFocus);
    this.publish();
    return true;
  }

  popTo(id: string): boolean {
    const index = this.entries.findIndex((e) => e.id === id);
    if (index === -1) return false;
    for (const entry of this.entries.slice(index + 1)) this.clearScreenScope(entry);
    this.entries = this.entries.slice(0, index + 1);

    const top = this.entries[this.entries.length - 1];
    if (top?.restoreFocus) this.deps.focus.focus(top.restoreFocus);
    this.publish();
    return true;
  }

  reset(id: string, params?: Record<string, unknown>): void {
    for (const entry of this.entries) this.clearScreenScope(entry);
    this.entries = [{ id, params }];
    this.publish();
  }

  current(): ScreenEntry | null {
    return this.entries[this.entries.length - 1] ?? null;
  }

  stack(): ScreenEntry[] {
    return [...this.entries];
  }

  canGoBack(): boolean {
    return this.entries.length > 1;
  }

  /** A screen's own scope dies with it, unless it asked to be kept alive. */
  private clearScreenScope(entry: ScreenEntry | undefined): void {
    if (!entry) return;
    if (this.defs.get(entry.id)?.keepAlive) return;
    this.deps.store.clearScope(`screen.${entry.id}`);
  }
}

export function createNavigation(deps: ConstructorParameters<typeof Navigation>[0]): Navigation {
  return new Navigation(deps);
}
