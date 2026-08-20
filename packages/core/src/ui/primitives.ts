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
