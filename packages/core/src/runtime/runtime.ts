import type { ReactiveStore, EventBus } from '../types/store.js';
import type { ComponentRegistry } from '../types/component-registry.js';
import type { ResolvedTheme } from '../types/theme.js';
import type { TerminalCapabilities } from '../types/capabilities.js';
import type { Size } from '../types/geometry.js';
import type { ServiceContainer } from '../types/services.js';
import type { FocusManager } from '../types/focus.js';
import type { LayerManager } from '../types/layer.js';
import type { AnimationDriver } from '../types/animation.js';
import type { I18n } from '../types/i18n.js';
import type { WhenEngine } from '../types/when.js';
import type { TextUIApp } from '../types/app.js';

/**
 * What the reconciler and the hooks are allowed to reach.
 *
 * Narrower than the app on purpose: the render tree should depend on the few
 * things it actually uses, so a component can be rendered by the test harness
 * or the static renderer without an application, a terminal or a frame loop.
 */
export interface Runtime {
  store: ReactiveStore;
  events: EventBus;
  when: WhenEngine;
  components: ComponentRegistry;
  services: ServiceContainer;
  focus: FocusManager;
  layers: LayerManager;
  animation: AnimationDriver;
  i18n: I18n;

  theme(): ResolvedTheme;
  capabilities(): TerminalCapabilities;
  size(): Size;

  execute(id: string, args?: Record<string, unknown>): unknown;
  emit(path: string, payload?: unknown): void;

  /** Ask for another frame. Coalesced by the scheduler. */
  requestRender(): void;

  /** The application, when there is one. Null under the static renderer. */
  app(): TextUIApp | null;

  /** Where render-time errors go. */
  onError(err: unknown, context: string): void;
}
