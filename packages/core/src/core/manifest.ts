import type { Manifest, ManifestAPI, ManifestSource } from '../types/manifest.js';
import type { TextUIApp } from '../types/app.js';
import type { Disposable } from '../types/disposable.js';
import { createBag } from '../util/disposable.js';

/**
 * Manifests.
 *
 * Separate typed lists rather than one generic plugin bag: every category has
 * its own contract, so a bad contribution fails where it is written instead of
 * at some later lookup. Loading returns one disposable that unwinds everything
 * the source contributed, which is what makes unloading exact.
 */
export class Manifests implements ManifestAPI {
  private loaded_ = new Map<string, { source: ManifestSource; disposable: Disposable }>();

  constructor(private app: TextUIApp) {}

  async load(manifest: Manifest): Promise<Disposable> {
    const { id } = manifest.source;
    if (this.loaded_.has(id)) {
      throw new Error(`[textui] manifest "${id}" is already loaded`);
    }

    for (const required of manifest.requires ?? []) {
      if (!this.loaded_.has(required)) {
        throw new Error(`[textui] manifest "${id}" requires "${required}", which is not loaded`);
      }
    }

    const caps = this.app.capabilities as unknown as Record<string, unknown>;
    const missing = (manifest.requiresCapabilities ?? []).filter((c) => !caps[c]);
    if (missing.length > 0) {
      throw new Error(
        `[textui] manifest "${id}" needs terminal capabilities this session lacks: ${missing.join(', ')}`,
      );
    }

    const bag = createBag();
    const c = manifest.contributes ?? {};

    for (const def of c.components ?? []) bag.add(this.app.components.register(def));
    for (const def of c.commands ?? []) bag.add(this.app.commands.register(def));
    for (const def of c.keybindings ?? []) bag.add(this.app.keybindings.register(def));
    for (const def of c.themes ?? []) bag.add(this.app.themes.register(def));
    for (const def of c.shells ?? []) bag.add(this.app.shells.register(def));
    for (const def of c.layouts ?? []) bag.add(this.app.layouts.register(def));
    for (const def of c.screens ?? []) bag.add(this.app.screens.register(def));
    for (const def of c.resourceKinds ?? []) bag.add(this.app.resources.registerKind(def));
    for (const def of c.resourceProviders ?? []) bag.add(this.app.resources.registerProvider(def));
    for (const def of c.resourceViewers ?? []) bag.add(this.app.resources.registerViewer(def));
    for (const def of c.resourceEditors ?? []) bag.add(this.app.resources.registerEditor(def));
    for (const def of c.resourceActions ?? []) bag.add(this.app.resources.registerAction(def));
    for (const def of c.dataProviders ?? []) bag.add(this.app.store.registerDataProvider(def));
    for (const entry of c.computed ?? []) bag.add(this.app.store.computed(entry.path, entry.def));
    // Views mount last: they may name a component this manifest just added.
    for (const mount of c.views ?? []) bag.add(this.app.open(mount));

    const disposable = {
      dispose: () => {
        bag.dispose();
        this.loaded_.delete(id);
      },
    };
    this.loaded_.set(id, { source: manifest.source, disposable });
    return disposable;
  }

  unload(sourceId: string): void {
    this.loaded_.get(sourceId)?.disposable.dispose();
  }

  sources(): ManifestSource[] {
    return [...this.loaded_.values()].map((e) => e.source);
  }

  loaded(sourceId: string): boolean {
    return this.loaded_.has(sourceId);
  }
}

export function createManifests(app: TextUIApp): Manifests {
  return new Manifests(app);
}
