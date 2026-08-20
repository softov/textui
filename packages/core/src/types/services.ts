import type { Disposable } from './disposable.js';

/**
 * A service key is a typed token. This is a lookup table with types, not a
 * dependency-injection container - there is no lifecycle, no scoping and no
 * auto-wiring, on purpose.
 */
export interface ServiceKey<T> {
  readonly id: string;
  /** Never present at runtime; carries the type. */
  readonly __type?: T;
}

export function serviceKey<T>(id: string): ServiceKey<T> {
  return { id };
}

export interface ServiceContainer {
  provide<T>(key: ServiceKey<T>, value: T): Disposable;
  /** Created on first use. */
  provideLazy<T>(key: ServiceKey<T>, factory: () => T): Disposable;
  get<T>(key: ServiceKey<T>): T | undefined;
  /** Throws with the key id when missing - a clear programmer error. */
  require<T>(key: ServiceKey<T>): T;
  has<T>(key: ServiceKey<T>): boolean;
  /** A child container that falls back to this one. */
  child(): ServiceContainer;
}
