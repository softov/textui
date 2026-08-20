import type { Disposable } from './disposable.js';
import type { BindingPath, ComponentNode } from './graph.js';
import type { WhenClause } from './when.js';
import type { StyleColor } from './style.js';

/**
 * Nine surface names, fixed, because they are the vocabulary a layout, a
 * keybinding scope and a shell all have to share. A shell decides where they
 * go on screen; some shells render only a few of them.
 */
export type SurfaceName =
  | 'header'      // title bar / tab strip
  | 'rail'        // narrow icon strip (an activity bar)
  | 'sidebar'     // primary side region
  | 'aside'       // secondary side region
  | 'main'        // the content
  | 'panel'       // bottom drawer: logs, output, terminal
  | 'status'      // one-line status bar
  | 'overlay'     // modals, palettes, popovers, tooltips
  | 'notify';     // toasts

export interface MountDisplay {
  title?: string;
  subtitle?: string;
  icon?: string;
  color?: StyleColor;
  badge?: string | number;
  /** Commands offered in this mount's header. */
  actions?: string[];
}

export interface MountPolicy {
  /** Survives a session snapshot. */
  persistent?: boolean;
  /** Removed on the next navigation. Previews want this. */
  transient?: boolean;
  closable?: boolean;
  /** The user may move it to another surface. */
  movable?: boolean;
}

/** An inline node, or a binding whose value is a node. */
export type MountTarget = ComponentNode | { path: BindingPath };

export interface Mount {
  key: string;
  surface: SurfaceName;
  target: MountTarget;
  display?: MountDisplay;
  policy?: MountPolicy;
  when?: WhenClause;
  /** Relative paths inside this mount resolve against here. */
  dataContext?: BindingPath;
  order?: number;
}

/** How a surface arranges the several mounts it holds. */
export type LayoutName =
  | 'single'    // only the active one
  | 'tabs'      // tab strip plus the active one
  | 'stack'     // all of them, vertically
  | 'split'     // all of them, resizable
  | 'rail'      // icons only
  | 'bar'       // one line, horizontal
  | 'inline'    // all of them, no chrome
  | 'floating'  // positioned; overlay uses this
  | 'toast';    // stacked, ephemeral

export interface SurfaceState {
  layout: LayoutName;
  activeKey: string | null;
  visible: boolean;
  /** Cells along the surface's cross axis. Unset lets the shell decide. */
  size?: number;
  collapsed?: boolean;
}

export interface SurfaceRegistry {
  open(mount: Mount): Disposable;
  close(surface: SurfaceName, key: string): void;
  closeAll(surface: SurfaceName): void;
  get(surface: SurfaceName, key: string): Mount | undefined;
  mounts(surface: SurfaceName): Mount[];
  activate(surface: SurfaceName, key: string): void;
  state(surface: SurfaceName): SurfaceState;
  setState(surface: SurfaceName, patch: Partial<SurfaceState>): void;
  /** Resolve a resource's viewer and mount it. */
  openResource(uri: string, options?: { surface?: SurfaceName; viewerId?: string; mode?: 'view' | 'edit' }): Promise<Disposable | null>;
}

/** A layout is a component that receives a surface's mounts and renders them. */
export interface LayoutDefinition {
  name: LayoutName | (string & {});
  /** Component name receiving `{ surface, mounts, state }`. */
  component: string;
  title?: string;
  /** Surfaces this layout is offered for. Unset = all. */
  surfaces?: SurfaceName[];
}

export interface LayoutRegistry {
  register(def: LayoutDefinition): Disposable;
  get(name: string): LayoutDefinition | undefined;
  list(surface?: SurfaceName): LayoutDefinition[];
}
