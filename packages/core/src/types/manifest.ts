import type { Disposable } from './disposable.js';
import type { ComponentDefinition } from './component-registry.js';
import type { CommandDefinition } from './command.js';
import type { KeybindingDefinition } from './keybinding.js';
import type { ThemeDefinition } from './theme.js';
import type { ShellDefinition } from './shell.js';
import type { LayoutDefinition, Mount } from './surface.js';
import type { ScreenDefinition } from './navigation.js';
import type {
  ResourceActionDefinition, ResourceEditorDefinition, ResourceKind,
  ResourceProvider, ResourceViewerDefinition,
} from './resource.js';
import type { ComputedDefinition, DataProviderDefinition } from './store.js';
import type { BindingPath } from './graph.js';
import type { CapabilityName } from './capabilities.js';

/**
 * One source contributing to the typed registries. Deliberately not a generic
 * plugin bag: every category is its own list with its own type, so a bad
 * contribution fails where it is written.
 */
export interface ManifestSource {
  id: string;
  version?: string;
  displayName?: string;
}

export interface Contributes {
  components?: ComponentDefinition[];
  commands?: CommandDefinition[];
  keybindings?: KeybindingDefinition[];
  themes?: ThemeDefinition[];
  shells?: ShellDefinition[];
  layouts?: LayoutDefinition[];
  screens?: ScreenDefinition[];
  views?: Mount[];
  resourceKinds?: ResourceKind[];
  resourceProviders?: ResourceProvider[];
  resourceViewers?: ResourceViewerDefinition[];
  resourceEditors?: ResourceEditorDefinition[];
  resourceActions?: ResourceActionDefinition[];
  dataProviders?: DataProviderDefinition[];
  computed?: { path: BindingPath; def: ComputedDefinition }[];
}

export interface Manifest {
  source: ManifestSource;
  /** Other manifest ids that must load first. */
  requires?: string[];
  engine?: { textui: string };
  /** Refuse to load without these terminal capabilities. */
  requiresCapabilities?: CapabilityName[];
  contributes?: Contributes;
}

export interface ManifestAPI {
  load(manifest: Manifest): Promise<Disposable>;
  unload(sourceId: string): void;
  sources(): ManifestSource[];
  loaded(sourceId: string): boolean;
}

/**
 * Registry manifest metadata - what the CLI reads to copy a component's source
 * into a user's project and to tell later what changed upstream.
 */
export interface RegistryComponentManifest {
  name: string;
  description?: string;
  category?: string;
  version: string;
  /** Files copied into the project, relative to the registry root. */
  files: { path: string; target?: string; type?: 'component' | 'style' | 'test' | 'example' }[];
  /** Other registry components this one needs. */
  dependencies?: string[];
  /** npm packages this one needs. */
  npmDependencies?: Record<string, string>;
  requiredCapabilities?: CapabilityName[];
  optionalCapabilities?: CapabilityName[];
  variants?: string[];
  /** Store paths this component binds to by convention. */
  storeBindings?: string[];
  related?: string[];
  examples?: { name: string; file: string }[];
  /** Templates that include this component. */
  templates?: string[];
  /** Content hash of the copied files, so the CLI can detect local edits. */
  hash?: string;
}

export interface RegistryManifest {
  name: string;
  version: string;
  description?: string;
  homepage?: string;
  components: RegistryComponentManifest[];
  themes?: { name: string; file: string; appearance: 'light' | 'dark' }[];
  templates?: { name: string; description?: string; files: string[]; components: string[] }[];
}
