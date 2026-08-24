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

/*
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
 * Each carries its own doc below rather than sharing this one, because a
 * comment above a group attaches to the first declaration and leaves the rest
 * hovering as nothing - and going to the definition of a name that turns out
 * to be an undocumented string is worse than not going anywhere.
 */

/**
 * The container. Flex layout, background, border, title and footer.
 *
 * Props: `BoxProps`. The same node as `<box/>` - this constant is the string,
 * so JSX resolves the tag as an intrinsic rather than as a component.
 *
 * ```tsx
 * <Box border="round" padding={1} direction="column" gap={1}>
 *   <Text bold>Title</Text>
 * </Box>
 * ```
 */
export const Box = 'box' as const;

/**
 * A run of text. Wraps, truncates and aligns within its box.
 *
 * Props: `TextProps` - `content`, or children as a shorthand, plus `truncate`
 * and every style key. The same node as `<text/>`.
 *
 * ```tsx
 * <Text bold fg="success">{count} tests passed</Text>
 * ```
 */
export const Text = 'text' as const;

/**
 * Direct cell painting. The escape hatch charts and gauges use.
 *
 * Props: `CanvasProps` - a `draw` callback handed a surface and a render
 * context, and an `intrinsic` size for when the style does not fix one. Prefer
 * composing `Box` and `Text` where you can: the layout engine can reason about
 * those and cannot reason about this. The same node as `<canvas/>`.
 */
export const Canvas = 'canvas' as const;

/**
 * Empty space. Greedy by default, or a fixed number of cells.
 *
 * Props: `SpacerProps` - `size` in cells; leave it unset and it takes whatever
 * is left, which is how two things end up at opposite ends of a row. The same
 * node as `<spacer/>`.
 *
 * Between *every* child, `gap` on the container is shorter and does not need a
 * node per space.
 */
export const Spacer = 'spacer' as const;

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
