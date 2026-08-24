/**
 * One package to build a terminal UI with.
 *
 * The runtime, a terminal to put it on, and `render`. Nothing of its own
 * except that function - every other name here is re-exported from
 * `@textui/core` or `@textui/terminal`, and importing from those directly is
 * the same thing with a longer name.
 *
 * The component catalog is deliberately **not** here. `@textui/widgets` is a
 * separate install because an imported component registers itself just by
 * being imported, so nothing needs to know about it in advance - and a
 * hello world made of `Box` and `Text` should not carry eighty components it
 * never mentions.
 */
export * from '@textui/core';
export * from '@textui/terminal';
export { render } from './render.js';
export type { RenderOptions, RenderHandle } from './render.js';
