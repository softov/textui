import type { ComponentDefinition } from '../types/component-registry.js';
import type { HostComponent } from '../types/render.js';

/**
 * The host primitives.
 *
 * There are four, and there is a reason not to add a fifth: the layout engine
 * and the painter only reason about these shapes, so every component in the
 * catalog composing them means layout has one implementation rather than
 * dozens. Painting for `box`, `text` and `canvas` lives in the painter, which
 * is why these carry no `paint` of their own.
 */

/**
 * The primitives under Capitalized names, for JSX.
 *
 * These are the strings, not wrappers around them. JSX resolves a Capitalized
 * tag to the value in scope, and a value whose type is a string literal is an
 * intrinsic - so `<Box margin={2}/>` compiles to `h('box', { margin: 2 })`,
 * the identical node. No function to call, no extra depth in the tree, and
 * `BoxProps` still checks the props: `<Box notAProp/>` is the same error
 * `<box notAProp/>` is.
 *
 * They exist so a screen can be written in one case. Every other component is
 * Capitalized already - it has to be, that is how JSX tells a registry lookup
 * from a host tag - and the four primitives being the exception meant mixing
 * `<Row>` and `<box>` in one file. The lowercase names remain what the node
 * actually holds, and stay the spelling for a screen written as data.
 *
 * There is no `Spacer` here: the catalog already exports one, a component that
 * wraps this primitive and adds `size`.
 */
export const Box = 'box' as const;
export const Text = 'text' as const;
export const Canvas = 'canvas' as const;

const box: HostComponent = { name: 'box', container: true };
const text: HostComponent = { name: 'text', leaf: true };
const canvas: HostComponent = { name: 'canvas', leaf: true };
const spacer: HostComponent = { name: 'spacer', leaf: true };

export const PRIMITIVES: ComponentDefinition[] = [
  {
    component: 'box',
    category: 'layout',
    description: 'The container. Flex layout, background, border, title and footer.',
    renderer: { kind: 'host', host: box },
    role: 'presentation',
  },
  {
    component: 'text',
    category: 'display',
    description: 'A run of text. Wraps, truncates and aligns within its box.',
    renderer: { kind: 'host', host: text },
    role: 'presentation',
  },
  {
    component: 'canvas',
    category: 'display',
    description: 'Direct cell painting. The escape hatch charts and gauges use.',
    renderer: { kind: 'host', host: canvas },
    role: 'presentation',
  },
  {
    component: 'spacer',
    category: 'layout',
    description: 'Empty space. Sized, or greedy when given flex.',
    renderer: { kind: 'host', host: spacer },
    role: 'presentation',
  },
];
