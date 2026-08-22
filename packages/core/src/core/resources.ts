import type {
  Resource, ResourceActionDefinition, ResourceEditorDefinition, ResourceKind,
  ResourceMetadata, ResourceProvider, ResourceRegistry, ResourceURI,
  ResourceRendererDefinition, ResourceViewerDefinition,
} from '../types/resource.js';
import type { ComponentNode } from '../types/graph.js';
import type { ComponentRegistry } from '../types/component-registry.js';
import type { WhenEngine } from '../types/when.js';
import type { Disposable } from '../types/disposable.js';
import { toDisposable } from '../util/disposable.js';
import { nameOf } from './syntax.js';

function schemeOf(uri: ResourceURI): string {
  const i = uri.indexOf(':');
  return i === -1 ? 'file' : uri.slice(0, i);
}

function matchesGlob(name: string, pattern: string): boolean {
  if (pattern.startsWith('*.')) return name.toLowerCase().endsWith(pattern.slice(1).toLowerCase());
  return name.toLowerCase() === pattern.toLowerCase();
}

/**
 * The resource model.
 *
 * A resource is anything addressable that something can be registered to
 * display, edit or act on - a file, a record, a log stream, a service. The
 * filesystem is one provider among several rather than the model itself, which
 * is what lets an explorer browse services and files with the same component.
 *
 * Kinds form a hierarchy by dotted name: `file.markdown` specialises
 * `file.text`, so a viewer registered for `file.text` still opens a markdown
 * file when no more specific one exists.
 */
export class Resources implements ResourceRegistry {
  private kindDefs = new Map<string, ResourceKind>();
  private providers = new Map<string, ResourceProvider>();
  private viewers: ResourceViewerDefinition[] = [];
  private editors: ResourceEditorDefinition[] = [];
  private actions: ResourceActionDefinition[] = [];

  constructor(
    private deps: {
      components: ComponentRegistry;
      when: WhenEngine;
    },
  ) {}

  registerKind(kind: ResourceKind): Disposable {
    this.kindDefs.set(kind.id, kind);
    return toDisposable(() => this.kindDefs.delete(kind.id));
  }

  registerProvider(provider: ResourceProvider): Disposable {
    this.providers.set(provider.scheme, provider);
    return toDisposable(() => this.providers.delete(provider.scheme));
  }

  registerViewer(def: ResourceViewerDefinition): Disposable {
    this.viewers.push(def);
    return toDisposable(() => {
      const i = this.viewers.indexOf(def);
      if (i >= 0) this.viewers.splice(i, 1);
    });
  }

  registerEditor(def: ResourceEditorDefinition): Disposable {
    this.editors.push(def);
    return toDisposable(() => {
      const i = this.editors.indexOf(def);
      if (i >= 0) this.editors.splice(i, 1);
    });
  }

  registerAction(def: ResourceActionDefinition): Disposable {
    this.actions.push(def);
    return toDisposable(() => {
      const i = this.actions.indexOf(def);
      if (i >= 0) this.actions.splice(i, 1);
    });
  }

  kinds(): ResourceKind[] {
    return [...this.kindDefs.values()];
  }

  /** Extension, then mime type, then an explicit `detect`. Best match wins. */
  detectKind(uri: ResourceURI, meta: ResourceMetadata = { name: uri }): string {
    const name = meta.name || nameOf(uri) || uri;
    const candidates: { id: string; score: number }[] = [];

    for (const kind of this.kindDefs.values()) {
      let score = kind.priority ?? 0;
      let matched = false;

      if (kind.extensions?.some((p) => matchesGlob(name, p))) {
        score += 100;
        matched = true;
      }
      if (meta.mimeType && kind.mimeTypes?.includes(meta.mimeType)) {
        score += 80;
        matched = true;
      }
      if (kind.detect?.(uri, meta)) {
        score += 200;
        matched = true;
      }
      // A more specific kind beats its parent on equal evidence.
      if (matched) {
        score += kind.id.split('.').length;
        candidates.push({ id: kind.id, score });
      }
    }

    if (candidates.length === 0) return meta.mimeType ? 'file' : 'unknown';
    candidates.sort((a, b) => b.score - a.score);
    return (candidates[0] as { id: string }).id;
  }

  kindMatches(kind: string, ancestor: string): boolean {
    if (kind === ancestor) return true;
    if (kind.startsWith(ancestor + '.')) return true;

    let cursor = this.kindDefs.get(kind);
    const seen = new Set<string>();
    while (cursor?.extends && !seen.has(cursor.id)) {
      seen.add(cursor.id);
      if (cursor.extends === ancestor) return true;
      cursor = this.kindDefs.get(cursor.extends);
    }
    return false;
  }

  private provider(uri: ResourceURI): ResourceProvider {
    const scheme = schemeOf(uri);
    const provider = this.providers.get(scheme);
    if (!provider) {
      throw new Error(`[textui] no resource provider registered for "${scheme}:"`);
    }
    return provider;
  }

  async stat(uri: ResourceURI): Promise<Resource | null> {
    const resource = await this.provider(uri).stat(uri);
    if (!resource) return null;
    // A provider may leave classification to the registry.
    if (!resource.kind || resource.kind === 'unknown') {
      return { ...resource, kind: this.detectKind(uri, resource.metadata) };
    }
    return resource;
  }

  async list(uri: ResourceURI): Promise<Resource[]> {
    const provider = this.provider(uri);
    if (!provider.list) return [];
    const items = await provider.list(uri);
    return items.map((r) =>
      r.kind && r.kind !== 'unknown' ? r : { ...r, kind: this.detectKind(r.uri, r.metadata) },
    );
  }

  async read(uri: ResourceURI): Promise<string | Uint8Array> {
    const provider = this.provider(uri);
    if (!provider.read) throw new Error(`[textui] "${schemeOf(uri)}:" cannot be read`);
    return provider.read(uri);
  }

  async write(uri: ResourceURI, content: string | Uint8Array): Promise<void> {
    const provider = this.provider(uri);
    if (!provider.write) throw new Error(`[textui] "${schemeOf(uri)}:" is read-only`);
    return provider.write(uri, content);
  }

  /**
   * Destructive calls throw when the provider cannot serve them, the same way
   * `write` does. A silent no-op is the failure mode worth designing against:
   * a Delete that appears in the menu and removes nothing is worse than one
   * that says it cannot.
   *
   * Whether to *offer* the action is a different question, answered before
   * the call by `Resource.capabilities` - which is per resource rather than
   * per provider, so a read-only mount, a file without permission and an
   * inherently immutable resource are all the same shape. The throw is for
   * the race that asking first cannot close: the remote goes away, the
   * permission changes, between the offer and the call.
   */
  async delete(uri: ResourceURI): Promise<void> {
    const provider = this.provider(uri);
    if (!provider.delete) throw new Error(`[textui] "${schemeOf(uri)}:" cannot delete`);
    return provider.delete(uri);
  }

  /**
   * A rename is within one provider. Two schemes is a move between providers,
   * which is a copy and a delete and belongs above a registry that dispatches
   * on a single scheme by construction.
   */
  async rename(from: ResourceURI, to: ResourceURI): Promise<void> {
    const scheme = schemeOf(from);
    if (schemeOf(to) !== scheme) {
      throw new Error(
        `[textui] cannot rename across schemes: "${scheme}:" to "${schemeOf(to)}:"`,
      );
    }
    const provider = this.provider(from);
    if (!provider.rename) throw new Error(`[textui] "${scheme}:" cannot rename`);
    return provider.rename(from, to);
  }

  /**
   * Watching follows `list` rather than `write`: a provider that cannot watch
   * gets a disposable that does nothing, because "I will never tell you about
   * a change" is a truthful answer to an optional question. Making every
   * caller guard a subscription would buy nothing.
   */
  watch(uri: ResourceURI, fn: (event: 'change' | 'create' | 'delete') => void): Disposable {
    const provider = this.provider(uri);
    return provider.watch?.(uri, fn) ?? toDisposable(() => {});
  }

  viewersFor(kind: string): ResourceViewerDefinition[] {
    const specific = this.viewers
      .filter((v) => !v.fallback && v.kinds.some((k) => this.kindMatches(kind, k)))
      .filter((v) => this.deps.when.evaluate(v.when))
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    const fallbacks = this.viewers
      .filter((v) => v.fallback)
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    return [...specific, ...fallbacks];
  }

  editorsFor(kind: string): ResourceEditorDefinition[] {
    return this.editors
      .filter((e) => e.kinds.some((k) => this.kindMatches(kind, k)))
      .filter((e) => this.deps.when.evaluate(e.when))
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }

  /**
   * Every way of showing this kind, best first.
   *
   * Three registries answer the same question - an editor, a viewer and a
   * component that declared `opens` are all "a component that can put this on
   * screen" - and a panel offering "open with" wants one list. Saving is a
   * property of the renderer here rather than the registry it came from, which
   * is what lets `file.markdown` list an editor, a rendered view and plain
   * text together and lets the panel pick between them.
   */
  renderersFor(kind: string): ResourceRendererDefinition[] {
    const seen = new Set<string>();
    const out: ResourceRendererDefinition[] = [];
    const add = (def: ResourceRendererDefinition): void => {
      if (seen.has(def.id)) return;
      seen.add(def.id);
      out.push(def);
    };

    for (const e of this.editorsFor(kind)) add({ ...e, saves: true });
    for (const v of this.viewersFor(kind)) add({ ...v, saves: false });
    for (const c of this.deps.components.findOpeners(kind)) {
      add({
        id: c.component,
        title: c.opens?.title ?? c.component,
        kinds: c.opens?.resourceKinds ?? [],
        component: c.component,
        ...(c.opens?.icon !== undefined ? { icon: c.opens.icon } : {}),
        ...(c.opens?.priority !== undefined ? { priority: c.opens.priority } : {}),
        saves: c.opens?.mode === 'edit',
      });
    }

    return out.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }

  actionsFor(kind: string, slot?: string): ResourceActionDefinition[] {
    return this.actions
      .filter((a) => a.kinds.some((k) => this.kindMatches(kind, k) || k === '*'))
      .filter((a) => !slot || (a.slots ?? ['context']).includes(slot))
      .filter((a) => this.deps.when.evaluate(a.when))
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }

  /**
   * The node that displays this resource. An explicit `viewerId` wins; then a
   * registered editor when edit was asked for; then the best viewer; then a
   * component that declared `opens` for this kind; then nothing.
   */
  nodeFor(
    resource: Resource,
    options: { viewerId?: string; mode?: 'view' | 'edit' } = {},
  ): ComponentNode | null {
    const props = { resource, uri: resource.uri };

    if (options.viewerId) {
      const chosen =
        this.viewers.find((v) => v.id === options.viewerId) ??
        this.editors.find((e) => e.id === options.viewerId);
      return chosen ? { component: chosen.component, ...props } : null;
    }

    if (options.mode === 'edit') {
      const editor = this.editorsFor(resource.kind)[0];
      if (editor) return { component: editor.component, ...props };
    }

    const viewer = this.viewersFor(resource.kind)[0];
    if (viewer) return { component: viewer.component, ...props };

    const opener = this.deps.components.findOpeners(resource.kind)[0];
    if (opener) return { component: opener.component, ...props };

    return null;
  }
}

export function createResources(deps: ConstructorParameters<typeof Resources>[0]): Resources {
  return new Resources(deps);
}
