import type {
  LayoutDefinition, LayoutName, LayoutRegistry, Mount, SurfaceName,
  SurfaceRegistry, SurfaceState,
} from '../types/surface.js';
import type { ShellDefinition, ShellRegistry } from '../types/shell.js';
import type { ReactiveStore } from '../types/store.js';
import type { WhenEngine } from '../types/when.js';
import type { ResourceRegistry } from '../types/resource.js';
import type { BindingPath } from '../types/graph.js';
import type { Disposable } from '../types/disposable.js';
import { toDisposable } from '../util/disposable.js';

export const SURFACE_NAMES: SurfaceName[] = [
  'header', 'rail', 'sidebar', 'aside', 'main', 'panel', 'status', 'overlay', 'notify',
];

const DEFAULT_LAYOUTS: Record<SurfaceName, LayoutName> = {
  header: 'bar',
  rail: 'rail',
  sidebar: 'stack',
  aside: 'stack',
  main: 'tabs',
  panel: 'tabs',
  status: 'bar',
  overlay: 'floating',
  notify: 'toast',
};

function statePath(surface: SurfaceName): BindingPath {
  return `$/layout/surfaces/${surface}` as BindingPath;
}

function mountsPath(surface: SurfaceName): BindingPath {
  return `$/layout/mounts/${surface}` as BindingPath;
}

/**
 * Surfaces, mounts and their state.
 *
 * Nine surface names, fixed, because they are the vocabulary a layout, a
 * keybinding scope and a shell all have to share. Which layout a surface uses
 * is store state rather than code, which is what makes it switchable at
 * runtime and persistable per user.
 */
export class Surfaces implements SurfaceRegistry {
  private byKey = new Map<string, Mount>();
  /** Subscriptions to the paths a mount's `when` clause reads. */
  private conditions = new Map<string, Disposable[]>();

  constructor(
    private deps: {
      store: ReactiveStore;
      when: WhenEngine;
      resources(): ResourceRegistry;
      onChange(): void;
    },
  ) {
    for (const surface of SURFACE_NAMES) {
      if (this.deps.store.get(statePath(surface)) === undefined) {
        this.deps.store.set(statePath(surface), {
          layout: DEFAULT_LAYOUTS[surface],
          activeKey: null,
          visible: true,
        } satisfies SurfaceState);
      }
    }
  }

  private id(surface: SurfaceName, key: string): string {
    return `${surface}/${key}`;
  }

  private publish(surface: SurfaceName): void {
    const list = this.mounts(surface).map((m) => ({
      key: m.key,
      display: m.display ?? {},
      policy: m.policy ?? {},
    }));
    this.deps.store.set(mountsPath(surface), list);
    this.deps.onChange();
  }

  open(mount: Mount): Disposable {
    const id = this.id(mount.surface, mount.key);
    this.byKey.set(id, mount);

    // A conditional mount has to react to the paths its clause reads, or it
    // stays hidden until something unrelated happens to redraw the surface.
    this.watchCondition(id, mount);

    const state = this.state(mount.surface);
    if (state.activeKey === null || mount.policy?.transient) {
      this.setState(mount.surface, { activeKey: mount.key });
    }
    this.publish(mount.surface);

    return toDisposable(() => this.close(mount.surface, mount.key));
  }

  close(surface: SurfaceName, key: string): void {
    const id = this.id(surface, key);
    this.unwatchCondition(id);
    if (!this.byKey.delete(id)) return;

    const state = this.state(surface);
    if (state.activeKey === key) {
      const remaining = this.mounts(surface);
      this.setState(surface, { activeKey: remaining[0]?.key ?? null });
    }
    this.publish(surface);
  }

  closeAll(surface: SurfaceName): void {
    for (const mount of this.all(surface)) {
      const id = this.id(surface, mount.key);
      this.unwatchCondition(id);
      this.byKey.delete(id);
    }
    this.setState(surface, { activeKey: null });
    this.publish(surface);
  }

  get(surface: SurfaceName, key: string): Mount | undefined {
    return this.byKey.get(this.id(surface, key));
  }

  private watchCondition(id: string, mount: Mount): void {
    this.unwatchCondition(id);
    if (!mount.when) return;

    const deps = this.deps.when.dependencies(mount.when);
    if (deps.length === 0) return;

    this.conditions.set(
      id,
      deps.map((path) =>
        this.deps.store.subscribe(path, () => this.publish(mount.surface))),
    );
  }

  private unwatchCondition(id: string): void {
    for (const sub of this.conditions.get(id) ?? []) sub.dispose();
    this.conditions.delete(id);
  }

  /** Every mount on a surface, conditional or not. */
  all(surface: SurfaceName): Mount[] {
    return [...this.byKey.values()]
      .filter((m) => m.surface === surface)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  /** Mounts whose `when` clause passes, in order. */
  mounts(surface: SurfaceName): Mount[] {
    return [...this.byKey.values()]
      .filter((m) => m.surface === surface && this.deps.when.evaluate(m.when))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  activate(surface: SurfaceName, key: string): void {
    if (!this.byKey.has(this.id(surface, key))) return;
    this.setState(surface, { activeKey: key });
  }

  state(surface: SurfaceName): SurfaceState {
    return (
      this.deps.store.get<SurfaceState>(statePath(surface)) ?? {
        layout: DEFAULT_LAYOUTS[surface],
        activeKey: null,
        visible: true,
      }
    );
  }

  setState(surface: SurfaceName, patch: Partial<SurfaceState>): void {
    this.deps.store.patch(statePath(surface), patch as Record<string, unknown>);
    this.deps.onChange();
  }

  /**
   * Resource-level open: ask the registry which viewer handles this kind, then
   * mount it. The caller never names a component, which is what lets a new
   * resource type arrive with its own viewer and work everywhere at once.
   */
  async openResource(
    uri: string,
    options: { surface?: SurfaceName; viewerId?: string; mode?: 'view' | 'edit' } = {},
  ): Promise<Disposable | null> {
    const resources = this.deps.resources();
    const resource = await resources.stat(uri);
    if (!resource) return null;

    const node = resources.nodeFor(resource, options);
    if (!node) return null;

    return this.open({
      surface: options.surface ?? 'main',
      key: uri,
      target: node,
      display: { title: resource.metadata.name, icon: resource.kind },
      policy: { closable: true },
    });
  }
}

export class Layouts implements LayoutRegistry {
  private defs = new Map<string, LayoutDefinition>();

  register(def: LayoutDefinition): Disposable {
    this.defs.set(def.name, def);
    return toDisposable(() => this.defs.delete(def.name));
  }

  get(name: string): LayoutDefinition | undefined {
    return this.defs.get(name);
  }

  list(surface?: SurfaceName): LayoutDefinition[] {
    const all = [...this.defs.values()];
    return surface ? all.filter((d) => !d.surfaces || d.surfaces.includes(surface)) : all;
  }
}

export class Shells implements ShellRegistry {
  private defs = new Map<string, ShellDefinition>();

  register(def: ShellDefinition): Disposable {
    this.defs.set(def.id, def);
    return toDisposable(() => this.defs.delete(def.id));
  }

  get(id: string): ShellDefinition | undefined {
    return this.defs.get(id);
  }

  list(): ShellDefinition[] {
    return [...this.defs.values()];
  }

  /** Shells that fit, largest minimum first - the richest one that works. */
  suitable(width: number, height: number): ShellDefinition[] {
    return [...this.defs.values()]
      .filter((s) => {
        const min = s.minSize;
        if (!min) return true;
        return (min.width ?? 0) <= width && (min.height ?? 0) <= height;
      })
      .sort((a, b) => {
        const av = (a.minSize?.width ?? 0) + (a.minSize?.height ?? 0);
        const bv = (b.minSize?.width ?? 0) + (b.minSize?.height ?? 0);
        return bv - av;
      });
  }
}

export function createSurfaces(deps: ConstructorParameters<typeof Surfaces>[0]): Surfaces {
  return new Surfaces(deps);
}
export function createLayouts(): Layouts {
  return new Layouts();
}
export function createShells(): Shells {
  return new Shells();
}
