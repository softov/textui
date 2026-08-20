import type { Disposable } from './disposable.js';
import type { ComponentDefinition } from './component-registry.js';
import type { CommandDefinition } from './command.js';
import type { KeybindingDefinition } from './keybinding.js';
import type { HighlighterDefinition } from './syntax.js';
import type {
  ResourceActionDefinition, ResourceEditorDefinition, ResourceKind,
  ResourceProvider, ResourceViewerDefinition,
} from './resource.js';
import type { TextUIApp } from './app.js';

/**
 * A resource adapter.
 *
 * Everything one resource type needs, in one value: what it is, where it comes
 * from, what opens it, how it is coloured, and what can be done to it. The
 * registries underneath stay separate - an adapter is a convenience for the
 * author and a unit of undo for the application, not a new mechanism.
 *
 * Registering returns a `Disposable` that removes exactly what was added, so a
 * plugin can be unloaded without the screen keeping a viewer nobody can
 * explain.
 */
export interface ResourceAdapter {
  id: string;
  title?: string;
  description?: string;
  kinds?: ResourceKind[];
  providers?: ResourceProvider[];
  viewers?: ResourceViewerDefinition[];
  editors?: ResourceEditorDefinition[];
  actions?: ResourceActionDefinition[];
  highlighters?: HighlighterDefinition[];
  /** Commands the adapter contributes. Usually one per action. */
  commands?: CommandDefinition[];
  keybindings?: KeybindingDefinition[];
  /** Components the viewers and editors name. */
  components?: ComponentDefinition[];
  /** Anything the fields above cannot express. */
  register?(app: TextUIApp): Disposable | void;
}
