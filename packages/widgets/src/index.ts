import type { ComponentDefinition, TextUIApp, Disposable } from '@textui/core';
import { createBag, PRIMITIVES } from '@textui/core';
import { LAYOUT_COMPONENTS } from './layout/index.js';
import { DISPLAY_COMPONENTS } from './display/index.js';
import { CONTROL_COMPONENTS } from './control/index.js';
import { FORM_COMPONENTS } from './form/index.js';
import { DATA_COMPONENTS } from './data/index.js';
import { NAVIGATION_COMPONENTS } from './navigation/index.js';
import { OVERLAY_COMPONENTS } from './overlay/index.js';
import { CHART_COMPONENTS } from './chart/index.js';
import { SURFACE_COMPONENTS, BUILTIN_LAYOUTS } from './surface/index.js';
import { SHELL_COMPONENTS, BUILTIN_SHELLS } from './shells/index.js';
import { PANEL_COMPONENTS, panelCommands } from './panel/index.js';

export * from './layout/index.js';
export * from './display/index.js';
export * from './control/index.js';
export * from './form/index.js';
export * from './data/index.js';
export * from './navigation/index.js';
export * from './overlay/index.js';
export * from './chart/index.js';
export * from './surface/index.js';
export * from './shells/index.js';
export * from './panel/index.js';
export * from './decorations.js';
export * from './find.js';
export * from './viewport.js';
export * from './tone.js';

/** Every component the library ships, in one list. */
export const CATALOG: ComponentDefinition[] = [
  ...PRIMITIVES,
  ...LAYOUT_COMPONENTS,
  ...DISPLAY_COMPONENTS,
  ...CONTROL_COMPONENTS,
  ...FORM_COMPONENTS,
  ...DATA_COMPONENTS,
  ...NAVIGATION_COMPONENTS,
  ...OVERLAY_COMPONENTS,
  ...CHART_COMPONENTS,
  ...SURFACE_COMPONENTS,
  ...SHELL_COMPONENTS,
  ...PANEL_COMPONENTS,
];

/**
 * Register the catalog, the surface layouts and the built-in shells.
 *
 * One call, because a half-registered catalog fails at mount time rather than
 * at boot - and a runtime miss is much harder to read than a boot error.
 */
export function registerBuiltins(app: TextUIApp): Disposable {
  const bag = createBag();
  bag.add(app.components.registerMany(CATALOG));
  for (const layout of BUILTIN_LAYOUTS) bag.add(app.layouts.register(layout));
  for (const shell of BUILTIN_SHELLS) bag.add(app.shells.register(shell));
  // The panel commands come with the panel: what they offer is read off the
  // resource registry, so a host that mounts a panel has already said
  // everything "open with" needs. Keys stay the host's choice.
  for (const command of panelCommands(app)) bag.add(app.commands.register(command));
  return bag;
}
