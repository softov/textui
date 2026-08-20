import type { Disposable } from './disposable.js';
import type { SurfaceName } from './surface.js';

/**
 * The shell is the frame around the surfaces. Where it puts them is the whole
 * of what a shell decides - which is why the same application renders as a
 * dense bordered console, an airy borderless report or a full workbench by
 * changing one registration.
 */
export interface ShellDefinition {
  id: string;
  title: string;
  description?: string;
  /** Component name; receives `{ surfaces, renderSurface }`. */
  component: string;
  /** Surfaces this shell renders. Others stay unmounted. */
  surfaces?: SurfaceName[];
  /** Default theme id this shell was designed against. */
  theme?: string;
  /** Below this width or height the shell is not offered. */
  minSize?: { width?: number; height?: number };
}

export interface ShellRegistry {
  register(def: ShellDefinition): Disposable;
  get(id: string): ShellDefinition | undefined;
  list(): ShellDefinition[];
  /** Shells that fit the current terminal, best first. */
  suitable(width: number, height: number): ShellDefinition[];
}
