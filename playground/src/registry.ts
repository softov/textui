import type { ComponentNode, TextUIApp } from '@textui/core';
import { h } from '@textui/core';

import { Gallery } from './playgrounds/gallery.js';
import { LayoutPlayground } from './playgrounds/layout.js';
import { StorePlayground } from './playgrounds/store.js';
import { FormsPlayground } from './playgrounds/forms.js';
import { DataPlayground } from './playgrounds/data.js';
import { ChartsPlayground } from './playgrounds/charts.js';
import { OverlaysPlayground } from './playgrounds/overlays.js';
import { FocusPlayground } from './playgrounds/focus.js';
import { CommandsPlayground } from './playgrounds/commands.js';
import { CapabilitiesPlayground } from './playgrounds/capabilities.js';
import { AnimationPlayground } from './playgrounds/animation.js';
import { StressPlayground } from './playgrounds/stress.js';
import { ShellsPlayground } from './playgrounds/shells.js';
import { PatternPlayground } from './playgrounds/pattern.js';
import { Explorer } from './examples/explorer.js';
import { registerFilesystem } from './examples/filesystem.js';
import { jsonAdapter, registerDocuments } from '@textui/documents';
import { seedStore } from './data.js';

/**
 * Every playground, in one list.
 *
 * The list is what the runner offers and what the test suite walks, so a
 * playground that is added without being registered is one nobody runs and
 * nothing checks - which is why there is exactly one place to add them.
 */
export interface Playground {
  id: string;
  title: string;
  description: string;
  /** What this playground is meant to exercise. Shown by `--list`. */
  exercises: string[];
  shell?: string;
  theme?: string;
  /** Minimum size at which this playground is worth looking at. */
  minSize?: { width: number; height: number };
  node(): ComponentNode;
  /** Extra registration, beyond the seeded store. */
  setup?(app: TextUIApp): void;
}

export const PLAYGROUNDS: Playground[] = [
  {
    id: 'gallery',
    title: 'Gallery',
    description: 'Every component, by category.',
    exercises: ['components', 'themes'],
    node: () => h(Gallery, {}),
  },
  {
    id: 'layout',
    title: 'Layout',
    description: 'Flex, grid, scrolling and splitters. Resize while it runs.',
    exercises: ['layout', 'resizing'],
    node: () => h(LayoutPlayground, {}),
  },
  {
    id: 'pattern',
    title: 'Pattern',
    description: 'A tile repeated across and down, under or over its content.',
    exercises: ['repeat counts', 'layering', 'measurement'],
    minSize: { width: 84, height: 24 },
    node: () => h(PatternPlayground, {}),
  },
  {
    id: 'store',
    title: 'Store',
    description: 'One path, several readers, a collection and a computed path.',
    exercises: ['store reactivity'],
    node: () => h(StorePlayground, {}),
    setup: (app) => {
      // Nothing seeds `$/demo/agent/name` here: the screen's `useStore` call
      // does it, and the two mirrors below it read the same path with
      // `useStoreValue` and no fallback of their own. If the initial value
      // were private to the writer, they would render blank.
      app.store.computed('$/summary/demo/alerts', {
        from: ['$/demo/alerts/list'],
        select: 'count',
      });
    },
  },
  {
    id: 'forms',
    title: 'Forms',
    description: 'Validation, including a rule that spans two fields.',
    exercises: ['forms', 'validation'],
    node: () => h(FormsPlayground, {}),
  },
  {
    id: 'data',
    title: 'Data',
    description: 'Table, tree and log viewer over the same fixtures.',
    exercises: ['tables/lists', 'resizing'],
    node: () => h(DataPlayground, {}),
  },
  {
    id: 'charts',
    title: 'Charts',
    description: 'Sparkline, line, area, bars, histogram, gauge and heatmap.',
    exercises: ['charts', 'capabilities'],
    node: () => h(ChartsPlayground, {}),
  },
  {
    id: 'overlays',
    title: 'Overlays',
    description: 'Dialogs, palette, toasts and the confirm/prompt helpers.',
    exercises: ['overlays', 'focus'],
    node: () => h(OverlaysPlayground, {}),
  },
  {
    id: 'focus',
    title: 'Focus',
    description: 'Tab order, directional navigation and the manager readout.',
    exercises: ['focus'],
    node: () => h(FocusPlayground, {}),
  },
  {
    id: 'commands',
    title: 'Commands',
    description: 'Commands, keybindings and a when clause that disables one.',
    exercises: ['commands'],
    node: () => h(CommandsPlayground, {}),
    setup: (app) => {
      app.keybindings.register({ keys: '+', commandId: 'demo.increment' });
      app.keybindings.register({ keys: 'ctrl+r', commandId: 'demo.reset' });
    },
  },
  {
    id: 'capabilities',
    title: 'Capabilities',
    description: 'What this terminal supports, and how output degrades.',
    exercises: ['terminal capabilities', 'adapters'],
    node: () => h(CapabilitiesPlayground, {}),
  },
  {
    id: 'animation',
    title: 'Animation',
    description: 'Spinners, tweens and the global off switch.',
    exercises: ['animations'],
    node: () => h(AnimationPlayground, {}),
  },
  {
    id: 'stress',
    title: 'Stress',
    description: 'A thousand rows with one column changing every frame.',
    exercises: ['performance'],
    node: () => h(StressPlayground, {}),
  },
  {
    id: 'shells',
    title: 'Shells',
    description: 'Switch shell and theme without the screen moving.',
    exercises: ['shells', 'themes'],
    node: () => h(ShellsPlayground, {}),
  },
  {
    id: 'explorer',
    title: 'Explorer',
    description: 'The filesystem through the resource registry.',
    exercises: ['resources', 'registries', 'documents'],
    minSize: { width: 90, height: 24 },
    node: () => h(Explorer, { root: process.cwd() }),
    setup: (app) => {
      registerFilesystem(app, { readonly: true });
      // The viewers are no longer part of `registerBuiltins`.
      registerDocuments(app);
      // One line is what "JSON is understood here" costs: a kind, a
      // highlighter, two viewers and the transforms, none of which the
      // explorer knows about.
      app.registerAdapter(jsonAdapter());
    },
  },
];

export function findPlayground(id: string): Playground | undefined {
  return PLAYGROUNDS.find((p) => p.id === id);
}

/** Seed the store, then run the playground's own registration. */
export function setupPlayground(app: TextUIApp, playground: Playground): void {
  seedStore(app);
  playground.setup?.(app);
}
