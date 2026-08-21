import type { ComponentDefinition } from '../types/component-registry.js';
import type { TextUIApp } from '../types/app.js';
import type { Disposable } from '../types/disposable.js';
import { createBag } from '../util/disposable.js';
import { PRIMITIVES } from './primitives.js';
import { LAYOUT_COMPONENTS } from './layout.js';
import { DISPLAY_COMPONENTS } from './display.js';
import { CONTROL_COMPONENTS } from './control.js';
import { FORM_COMPONENTS } from './form.js';
import { DATA_COMPONENTS } from './data.js';
import { NAVIGATION_COMPONENTS } from './navigation.js';
import { OVERLAY_COMPONENTS } from './overlay.js';
import { CHART_COMPONENTS } from './chart.js';
import { SURFACE_COMPONENTS, BUILTIN_LAYOUTS } from './surface.js';
import { SHELL_COMPONENTS, BUILTIN_SHELLS } from './shells.js';

export * from './primitives.js';
export * from './layout.js';
export * from './display.js';
export * from './control.js';
export * from './form.js';
export * from './data.js';
export * from './navigation.js';
export * from './overlay.js';
export * from './chart.js';
export * from './surface.js';
export * from './shells.js';
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
  return bag;
}
