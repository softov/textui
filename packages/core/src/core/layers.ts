import type { LayerEntry, LayerManager, LayerName } from '../types/layer.js';
import type { Disposable } from '../types/disposable.js';
import { toDisposable } from '../util/disposable.js';

const LAYER_ORDER: LayerName[] = ['base', 'floating', 'modal', 'notification', 'debug'];

/**
 * Layers are planes, not components.
 *
 * Dialogs, dropdowns, context menus, tooltips, palettes and toasts all sit on
 * one of five, which is what lets focus trapping, dismissal and paint order be
 * decided once here rather than five times in five components.
 */
export class Layers implements LayerManager {
  private byId = new Map<string, LayerEntry>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private counter = 0;

  constructor(private onChange: () => void = () => {}) {}

  open(entry: LayerEntry): Disposable {
    const order = entry.order ?? ++this.counter;
    this.byId.set(entry.id, { ...entry, order });

    if (entry.timeoutMs && entry.timeoutMs > 0) {
      const timer = setTimeout(() => this.close(entry.id, 'timeout'), entry.timeoutMs);
      timer.unref?.();
      this.timers.set(entry.id, timer);
    }

    this.onChange();
    return toDisposable(() => this.close(entry.id, 'api'));
  }

  close(id: string, reason: 'escape' | 'outside' | 'timeout' | 'api' = 'api'): void {
    const entry = this.byId.get(id);
    if (!entry) return;

    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }

    this.byId.delete(id);
    try {
      entry.onClose?.(reason);
    } finally {
      this.onChange();
    }
  }

  closeLayer(layer: LayerName): void {
    for (const entry of this.entries(layer)) this.close(entry.id, 'api');
  }

  /** Sorted by plane, then by open order - which is paint order. */
  entries(layer?: LayerName): LayerEntry[] {
    const all = [...this.byId.values()];
    const filtered = layer ? all.filter((e) => e.layer === layer) : all;
    return filtered.sort((a, b) => {
      const byLayer = LAYER_ORDER.indexOf(a.layer) - LAYER_ORDER.indexOf(b.layer);
      return byLayer !== 0 ? byLayer : (a.order ?? 0) - (b.order ?? 0);
    });
  }

  topmostTrap(): LayerEntry | null {
    const trapping = this.entries().filter((e) => e.trapFocus);
    return trapping[trapping.length - 1] ?? null;
  }

  /** The entry Escape should close: the last dismissible one. */
  topmostDismissible(): LayerEntry | null {
    const list = this.entries().filter((e) => e.dismissOnEscape !== false);
    return list[list.length - 1] ?? null;
  }

  update(id: string, patch: Partial<LayerEntry>): void {
    const entry = this.byId.get(id);
    if (!entry) return;
    this.byId.set(id, { ...entry, ...patch });
    this.onChange();
  }

  dispose(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    this.byId.clear();
  }
}

export function createLayers(onChange?: () => void): Layers {
  return new Layers(onChange);
}
