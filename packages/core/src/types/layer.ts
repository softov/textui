import type { Disposable } from './disposable.js';
import type { ComponentNode } from './graph.js';
import type { Rect } from './geometry.js';

/** Painting and input order. A layer is a plane, not a component. */
export type LayerName = 'base' | 'floating' | 'modal' | 'notification' | 'debug';

export type AnchorSide = 'top' | 'right' | 'bottom' | 'left';
export type AnchorAlign = 'start' | 'center' | 'end';

/** Position a layer entry relative to a focusable, a rect, or the screen. */
export type LayerPosition =
  | { kind: 'center' }
  | { kind: 'screen'; rect: Partial<Rect> }
  | { kind: 'anchor'; targetId: string; side: AnchorSide; align?: AnchorAlign; offset?: number }
  | { kind: 'point'; x: number; y: number }
  | { kind: 'cursor' };

export interface LayerEntry {
  id: string;
  layer: LayerName;
  node: ComponentNode;
  position?: LayerPosition;
  /** Dim everything beneath. Modals want this. */
  scrim?: boolean;
  /** Trap focus inside and restore it on close. */
  trapFocus?: boolean;
  /** Escape closes it. */
  dismissOnEscape?: boolean;
  /** A click outside closes it. */
  dismissOnOutsideClick?: boolean;
  /** Auto-remove after this many ms. Toasts want this. */
  timeoutMs?: number;
  onClose?(reason: 'escape' | 'outside' | 'timeout' | 'api'): void;
  order?: number;
}

export interface LayerManager {
  open(entry: LayerEntry): Disposable;
  close(id: string, reason?: 'escape' | 'outside' | 'timeout' | 'api'): void;
  closeLayer(layer: LayerName): void;
  entries(layer?: LayerName): LayerEntry[];
  /** The innermost entry that traps focus, if any. */
  topmostTrap(): LayerEntry | null;
  update(id: string, patch: Partial<LayerEntry>): void;
}
