import type { Disposable } from './disposable.js';
import type { Size } from './geometry.js';
import type { ReactiveStore, EventBus, ScopeName } from './store.js';
import type { ComponentRegistry } from './component-registry.js';
import type { CommandRegistry } from './command.js';
import type { KeybindingRegistry } from './keybinding.js';
import type { ThemeRegistry, ResolvedTheme, ThemeDefinition } from './theme.js';
import type { ShellRegistry } from './shell.js';
import type { LayoutRegistry, SurfaceRegistry, SurfaceName } from './surface.js';
import type { ResourceRegistry } from './resource.js';
import type { SyntaxRegistry } from './syntax.js';
import type { ResourceAdapter } from './adapter.js';
import type { Navigator } from './navigation.js';
import type { LayerManager } from './layer.js';
import type { FocusManager } from './focus.js';
import type { WhenEngine } from './when.js';
import type { I18n } from './i18n.js';
import type { ServiceContainer } from './services.js';
import type { AnimationDriver } from './animation.js';
import type { ManifestAPI } from './manifest.js';
import type { TerminalAdapter, TerminalSessionOptions } from './terminal.js';
import type { TerminalCapabilities, CapabilityOverrides } from './capabilities.js';
import type { ComponentNode } from './graph.js';
import type { CellBuffer } from './cells.js';

/**
 * The application. Every registry hangs off it, and every registry is late
 * binding, which is what lets a screen be data and a shell be swappable at
 * runtime.
 */
export interface TextUIApp extends Disposable {
  readonly components: ComponentRegistry;
  readonly commands: CommandRegistry;
  readonly keybindings: KeybindingRegistry;
  readonly themes: ThemeRegistry;
  readonly shells: ShellRegistry;
  readonly layouts: LayoutRegistry;
  readonly surfaces: SurfaceRegistry;
  readonly resources: ResourceRegistry;
  readonly syntax: SyntaxRegistry;
  readonly screens: Navigator;
  readonly layers: LayerManager;
  readonly focus: FocusManager;
  readonly store: ReactiveStore;
  readonly events: EventBus;
  readonly when: WhenEngine;
  readonly i18n: I18n;
  readonly services: ServiceContainer;
  readonly animation: AnimationDriver;
  readonly manifest: ManifestAPI;
  readonly terminal: TerminalAdapter;

  readonly capabilities: TerminalCapabilities;
  readonly theme: ResolvedTheme;
  readonly size: Size;
  readonly running: boolean;

  setTheme(id: string): void;
  setShell(id: string): void;
  activeShell(): string;
  setCapabilityOverrides(overrides: CapabilityOverrides): void;

  /** Acquire the terminal and start the render loop. */
  start(): Promise<void>;
  /** Release exactly what was acquired, then stop. */
  stop(): Promise<void>;
  /** Force a frame now, outside the scheduler. Tests and screenshots use it. */
  flush(): void;
  /** The last painted frame. */
  buffer(): CellBuffer;

  /**
   * Register a resource type whole: kinds, provider, viewers, highlighter,
   * actions, commands. Disposing removes exactly what was added.
   */
  registerAdapter(adapter: ResourceAdapter): Disposable;

  open: SurfaceRegistry['open'];
  openResource: SurfaceRegistry['openResource'];
  execute: CommandRegistry['execute'];

  /** Every mounted node's tree, for the inspector and the test harness. */
  inspect(): InspectorNode | null;

  /**
   * Frame statistics. `runs` is how many terminal writes the last frame cost,
   * which is the number that tells you whether the diff is doing its job.
   */
  stats(): { renders: number; runs: number; instances: number };
}

export interface InspectorNode {
  id: string;
  component: string;
  key?: string | number;
  rect?: { x: number; y: number; width: number; height: number };
  props: Record<string, unknown>;
  role?: string;
  label?: string;
  text?: string;
  focusable?: boolean;
  focused?: boolean;
  /** Why the last render happened, when diagnostics are on. */
  renderReason?: string;
  bindings?: string[];
  children: InspectorNode[];
}

export interface CreateAppOptions {
  terminal?: TerminalAdapter;
  session?: TerminalSessionOptions;
  theme?: string;
  themes?: ThemeDefinition[];
  shell?: string;
  /**
   * The root node, when the app is not using screens.
   *
   * It is mounted into the `main` surface at boot, so the shell still frames
   * it: the canvas is painted, the status surface and toast host exist, and
   * `setShell` means something. It is an alternative to screens, not to the
   * shell.
   */
  root?: ComponentNode;
  capabilityOverrides?: CapabilityOverrides;
  locale?: string;
  /** Register everything the app needs; runs before the first frame. */
  onBoot?(app: TextUIApp): void | Promise<void>;
  /** Off disables every animation globally. */
  animations?: boolean;
  maxFps?: number;
  /** Scopes cleared when `stop()` runs. */
  clearOnStop?: ScopeName[];
  /** Surfaces this app uses; others never mount. */
  surfaces?: SurfaceName[];
  /** Render diagnostics into `$/modus/diagnostics/*`. */
  diagnostics?: boolean;
}
