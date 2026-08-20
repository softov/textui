import type {
  ComponentCategory, ComponentDefinition, ComponentRegistry,
} from '../types/component-registry.js';
import type { Disposable } from '../types/disposable.js';
import { toDisposable, createBag } from '../util/disposable.js';

/**
 * Late binding is the mechanism the whole design rests on: a graph names a
 * component, and the name is resolved at mount time. A name that was never
 * registered is a runtime miss rather than a compile error - that is the price
 * of a screen being data, and it is why the miss renders visibly.
 */
export class Components implements ComponentRegistry {
  private defs = new Map<string, ComponentDefinition>();
  private resolving = new Map<string, Promise<ComponentDefinition>>();

  register(def: ComponentDefinition): Disposable {
    this.defs.set(def.component, def);
    return toDisposable(() => {
      if (this.defs.get(def.component) === def) this.defs.delete(def.component);
    });
  }

  registerMany(defs: ComponentDefinition[]): Disposable {
    const bag = createBag();
    for (const def of defs) bag.add(this.register(def));
    return bag;
  }

  unregister(component: string): void {
    this.defs.delete(component);
    this.resolving.delete(component);
  }

  get(component: string): ComponentDefinition | undefined {
    return this.defs.get(component);
  }

  has(component: string): boolean {
    return this.defs.has(component);
  }

  list(category?: ComponentCategory): ComponentDefinition[] {
    const all = [...this.defs.values()];
    return category ? all.filter((d) => d.category === category) : all;
  }

  async resolve(component: string): Promise<ComponentDefinition> {
    const def = this.defs.get(component);
    if (!def) throw new Error(`[textui] no component registered as "${component}"`);
    if (def.renderer.kind !== 'lazy') return def;

    const inFlight = this.resolving.get(component);
    if (inFlight) return inFlight;

    const load = def.renderer.load;
    const promise = Promise.resolve(load()).then((mod) => {
      const render = typeof mod === 'function' ? mod : mod.default;
      const resolved: ComponentDefinition = {
        ...def,
        renderer: { kind: 'function', render },
      };
      this.defs.set(component, resolved);
      this.resolving.delete(component);
      return resolved;
    });

    this.resolving.set(component, promise);
    return promise;
  }

  pending(): string[] {
    return [...this.defs.values()]
      .filter((d) => d.renderer.kind === 'lazy')
      .map((d) => d.component);
  }

  /**
   * Which components can display a resource of this kind. The selector is not
   * evaluated here - a caller with a store re-filters through `when`.
   */
  findOpeners(resourceKind: string): ComponentDefinition[] {
    return [...this.defs.values()]
      .filter((d) => d.opens?.resourceKinds?.some((k) => k === resourceKind || resourceKind.startsWith(k + '.')))
      .sort((a, b) => (b.opens?.priority ?? 0) - (a.opens?.priority ?? 0));
  }
}

export function createComponents(): Components {
  return new Components();
}
