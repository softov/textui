import type { Disposable } from './disposable.js';
import type { ComponentNode } from './graph.js';
import type { WhenClause } from './when.js';
import type { CommandHandler } from './command.js';

/**
 * A resource is anything addressable that a viewer, an editor or an action can
 * be registered for - a file, a record, a log stream, a service, a chart
 * source. The filesystem is one provider among several, not the model.
 */
export type ResourceURI = string;

export interface ResourceKind {
  /** Stable id: 'file.markdown', 'service', 'log.stream'. */
  id: string;
  title: string;
  icon?: string;
  /** MIME types this kind claims. */
  mimeTypes?: string[];
  /** Filename globs this kind claims. */
  extensions?: string[];
  /** Kinds this one specialises. `file.markdown` extends `file.text`. */
  extends?: string;
  /** Higher wins when several kinds match. */
  priority?: number;
  /** Last word on ambiguous matches. */
  detect?(uri: ResourceURI, meta: ResourceMetadata): boolean;
}

export interface ResourceMetadata {
  name: string;
  size?: number;
  modified?: number;
  created?: number;
  mimeType?: string;
  readonly?: boolean;
  /** Provider-specific extras. */
  [key: string]: unknown;
}

export type ResourceCapability =
  | 'read' | 'write' | 'delete' | 'rename' | 'list' | 'watch' | 'stream';

export interface Resource {
  uri: ResourceURI;
  kind: string;
  metadata: ResourceMetadata;
  capabilities: ResourceCapability[];
}

/** Where resources come from. One per URI scheme. */
export interface ResourceProvider {
  scheme: string;
  stat(uri: ResourceURI): Promise<Resource | null>;
  list?(uri: ResourceURI): Promise<Resource[]>;
  read?(uri: ResourceURI): Promise<string | Uint8Array>;
  write?(uri: ResourceURI, content: string | Uint8Array): Promise<void>;
  delete?(uri: ResourceURI): Promise<void>;
  rename?(from: ResourceURI, to: ResourceURI): Promise<void>;
  watch?(uri: ResourceURI, fn: (event: 'change' | 'create' | 'delete') => void): Disposable;
}

/** A component that can display one kind of resource. */
export interface ResourceViewerDefinition {
  id: string;
  title: string;
  kinds: string[];
  /** Component name; receives `{ resource, content }`. */
  component: string;
  icon?: string;
  priority?: number;
  when?: WhenClause;
  /** Accept anything no specific viewer claims. */
  fallback?: boolean;
}

export interface ResourceEditorDefinition extends ResourceViewerDefinition {
  /** Editors must be able to hand back new content. */
  saves: true;
}

export interface ResourceActionDefinition {
  id: string;
  title: string;
  kinds: string[];
  icon?: string;
  when?: WhenClause;
  /** Where the action offers itself: 'context', 'toolbar', 'palette'. */
  slots?: string[];
  priority?: number;
  run: CommandHandler;
}

export interface ResourceRegistry {
  registerKind(kind: ResourceKind): Disposable;
  registerProvider(provider: ResourceProvider): Disposable;
  registerViewer(def: ResourceViewerDefinition): Disposable;
  registerEditor(def: ResourceEditorDefinition): Disposable;
  registerAction(def: ResourceActionDefinition): Disposable;

  kinds(): ResourceKind[];
  /** Classify a resource: extension, then mime, then `detect`, then parent. */
  detectKind(uri: ResourceURI, meta?: ResourceMetadata): string;
  /** True when `kind` is `ancestor` or specialises it. */
  kindMatches(kind: string, ancestor: string): boolean;

  stat(uri: ResourceURI): Promise<Resource | null>;
  list(uri: ResourceURI): Promise<Resource[]>;
  read(uri: ResourceURI): Promise<string | Uint8Array>;
  write(uri: ResourceURI, content: string | Uint8Array): Promise<void>;

  viewersFor(kind: string): ResourceViewerDefinition[];
  editorsFor(kind: string): ResourceEditorDefinition[];
  actionsFor(kind: string, slot?: string): ResourceActionDefinition[];

  /** The node that displays this resource, viewer chosen by the registry. */
  nodeFor(resource: Resource, options?: { viewerId?: string; mode?: 'view' | 'edit' }): ComponentNode | null;
}
