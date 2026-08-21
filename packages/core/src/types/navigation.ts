import type { Disposable } from './disposable.js';
import type { ComponentNode } from './graph.js';
import type { MountDisplay, SurfaceName } from './surface.js';

/**
 * Screens and a stack, not a router. An application that wants URLs maps them
 * onto screens itself.
 */
export interface ScreenDefinition {
  id: string;
  /** Component name, or the node itself. */
  component: string | ComponentNode;
  display?: MountDisplay;
  /**
   * Where it mounts. `main` unless a screen wants to live somewhere else - a
   * surface is the application's word, so this is open like the rest of them.
   */
  surface?: SurfaceName;
  /** Screens keep their store scope when navigated away from. */
  keepAlive?: boolean;
}

export interface ScreenEntry {
  id: string;
  params?: Record<string, unknown>;
  /** Focus id to restore when this entry becomes current again. */
  restoreFocus?: string | null;
}

export interface Navigator {
  register(screen: ScreenDefinition): Disposable;
  screens(): ScreenDefinition[];
  get(id: string): ScreenDefinition | undefined;
  push(id: string, params?: Record<string, unknown>): void;
  replace(id: string, params?: Record<string, unknown>): void;
  pop(): boolean;
  popTo(id: string): boolean;
  reset(id: string, params?: Record<string, unknown>): void;
  current(): ScreenEntry | null;
  stack(): ScreenEntry[];
  canGoBack(): boolean;
}
