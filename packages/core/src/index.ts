// Contracts
export * from './types/index.js';

// JSX
export { h, Fragment, defineComponent, componentNameOf, toSerializable, nodeFunction } from './jsx/factory.js';
export type { BoxProps, TextProps, CanvasProps, SpacerProps, BaseProps } from './jsx/intrinsics.js';

// Core
export { createStore, Store } from './core/store.js';
export { createEvents, Events } from './core/events.js';
export { createWhen, When } from './core/when.js';
export { createComponents, Components } from './core/components.js';
export { createServices, Services } from './core/services.js';
export { createCommands, Commands } from './core/commands.js';
export { createKeybindings, Keybindings, strokeOf, splitStroke, normalizeStroke } from './core/keybindings.js';
export { createFocus, Focus, GLOBAL_SCOPE } from './core/focus.js';
export { createLayers, Layers } from './core/layers.js';
export { createAnimation, Animation } from './core/animation.js';
export { createI18n, I18nRegistry } from './core/i18n.js';
export { serviceKey } from './types/services.js';

// Render
export { Buffer, createBuffer } from './render/buffer.js';
export { diffFrame } from './render/diff.js';
export type { Frame, Run } from './render/diff.js';
export * from './render/color.js';
export { layout, measureBox, resolveEdges } from './render/layout.js';
export type { LayoutBox } from './render/layout.js';
export { render, renderToString, createStaticRuntime } from './render/static.js';
export type { StaticRenderOptions, StaticRenderResult } from './render/static.js';

// Runtime
export type { Runtime } from './runtime/runtime.js';
export type { Instance } from './runtime/instance.js';
export { renderTree, collectEffects, disposeTree } from './runtime/reconcile.js';
export { buildBoxes, paintTree, createRenderContext } from './runtime/paint.js';
export type { PaintEnv } from './runtime/paint.js';
export * from './runtime/style.js';
export * from './runtime/hooks.js';
export { Screen, SCREEN_COMPONENTS } from './ui/screen.js';
export type { ScreenProps } from './ui/screen.js';

// The application
export { App, createApp, WRITER_KEY } from './app/app.js';
export type { FrameWriter } from './app/app.js';

// Registries
export { createSurfaces, createLayouts, createShells, SURFACE_NAMES } from './core/surfaces.js';
export { createNavigation, Navigation } from './core/navigation.js';
export { createResources, Resources } from './core/resources.js';
export {
  createSyntax, Syntax, plainTokens, tokensFromSpans, spanHighlighter,
} from './core/syntax.js';
export { createManifests, Manifests } from './core/manifest.js';

// Themes and the component catalog
export * from './themes/index.js';
export * from './ui/index.js';

// Adapters
export * from './adapters/index.js';

// Utilities
export * from './util/text.js';
export * from './util/markdown.js';
export * from './util/paths.js';
export * from './util/stream.js';
export { createBag, toDisposable, disposeAll, NOOP_DISPOSABLE } from './util/disposable.js';
