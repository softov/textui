import type { Disposable } from './disposable.js';
import type { ComponentNode } from './graph.js';
import type { WhenClause } from './when.js';
import type { CapabilityName } from './capabilities.js';
import type { FunctionComponent, HostComponent } from './render.js';
import type { Style } from './style.js';

export type ComponentCategory =
  | 'layout' | 'display' | 'control' | 'form' | 'data' | 'navigation'
  | 'overlay' | 'feedback' | 'chart' | 'chrome' | 'resource' | 'template';

/** Late binding: a name, a category, and something that renders. */
export type ComponentRenderer =
  | { kind: 'function'; render: FunctionComponent }
  | { kind: 'host'; host: HostComponent }
  /** A component defined as data - the graph all the way down. */
  | { kind: 'template'; template: ComponentNode }
  /** Loaded on first mount. The catalog costs a name until something uses it. */
  | { kind: 'lazy'; load: () => Promise<{ default: FunctionComponent } | FunctionComponent> };

export type PropsSchema = Record<string, string | readonly string[]>;

/**
 * Declares that this component can render a resource kind. `findOpeners`
 * drives "Open with...", double-click in an explorer, and the resource picker.
 */
export interface ComponentOpensSpec {
  resourceKinds?: string[];
  selector?: WhenClause;
  title?: string;
  icon?: string;
  priority?: number;
  /** 'view' is read-only, 'edit' can write back. */
  mode?: 'view' | 'edit';
}

export interface ComponentDefinition {
  component: string;
  renderer: ComponentRenderer;
  category?: ComponentCategory;
  description?: string;
  propsSchema?: PropsSchema;
  /** Variants this component understands, for the theme and the CLI. */
  variants?: string[];
  /** Rendered instead when this subtree throws. */
  fallback?: ComponentNode;
  /** Degrades or refuses to mount without these. */
  requires?: CapabilityName[];
  /** Uses these when present, works without them. */
  enhancedBy?: CapabilityName[];
  opens?: ComponentOpensSpec;
  /** Default style, merged under the theme's entry for this component. */
  defaultStyle?: Style;
  /** Semantic role, for the testing harness and future a11y integrations. */
  role?: SemanticRole;
}

export type SemanticRole =
  | 'button' | 'textbox' | 'checkbox' | 'radio' | 'slider' | 'switch'
  | 'dialog' | 'alertdialog' | 'menu' | 'menuitem' | 'list' | 'listitem'
  | 'tree' | 'treeitem' | 'table' | 'row' | 'cell' | 'columnheader'
  | 'tab' | 'tablist' | 'tabpanel' | 'link' | 'heading' | 'label'
  | 'progressbar' | 'status' | 'alert' | 'region' | 'group' | 'separator'
  | 'toolbar' | 'searchbox' | 'combobox' | 'option' | 'presentation'
  | 'log' | 'timer' | 'marquee' | 'tooltip' | 'banner' | 'main' | 'navigation'
  | 'document'
  | 'complementary' | 'contentinfo' | 'form' | 'grid' | 'gridcell' | 'meter';

export interface ComponentRegistry {
  register(def: ComponentDefinition): Disposable;
  registerMany(defs: ComponentDefinition[]): Disposable;
  unregister(component: string): void;
  get(component: string): ComponentDefinition | undefined;
  has(component: string): boolean;
  list(category?: ComponentCategory): ComponentDefinition[];
  /** Resolve a lazy renderer. Idempotent, cached. */
  resolve(component: string): Promise<ComponentDefinition>;
  /** Names registered but not yet resolved. */
  pending(): string[];
  /** Components whose `opens` accepts this kind, best first. */
  findOpeners(resourceKind: string): ComponentDefinition[];
}
