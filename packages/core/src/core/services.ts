import type { ServiceContainer, ServiceKey } from '../types/services.js';
import type { Disposable } from '../types/disposable.js';
import { toDisposable } from '../util/disposable.js';

/**
 * A typed lookup table, not a dependency-injection container. No lifecycles,
 * no scoping rules, no auto-wiring - a child falls back to its parent and that
 * is the whole of it.
 */
export class Services implements ServiceContainer {
  private values = new Map<string, unknown>();
  private factories = new Map<string, () => unknown>();

  constructor(private parent: ServiceContainer | null = null) {}

  provide<T>(key: ServiceKey<T>, value: T): Disposable {
    this.values.set(key.id, value);
    return toDisposable(() => this.values.delete(key.id));
  }

  provideLazy<T>(key: ServiceKey<T>, factory: () => T): Disposable {
    this.factories.set(key.id, factory);
    return toDisposable(() => {
      this.factories.delete(key.id);
      this.values.delete(key.id);
    });
  }

  get<T>(key: ServiceKey<T>): T | undefined {
    if (this.values.has(key.id)) return this.values.get(key.id) as T;
    const factory = this.factories.get(key.id);
    if (factory) {
      const value = factory() as T;
      this.values.set(key.id, value);
      return value;
    }
    return this.parent?.get(key);
  }

  require<T>(key: ServiceKey<T>): T {
    const value = this.get(key);
    if (value === undefined) {
      throw new Error(`[textui] no service provided for "${key.id}"`);
    }
    return value;
  }

  has<T>(key: ServiceKey<T>): boolean {
    return this.values.has(key.id) || this.factories.has(key.id) || (this.parent?.has(key) ?? false);
  }

  child(): ServiceContainer {
    return new Services(this);
  }
}

export function createServices(parent?: ServiceContainer): Services {
  return new Services(parent ?? null);
}
