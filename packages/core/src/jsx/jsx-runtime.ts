import type { ComponentNode } from '../types/graph.js';
import type { FunctionComponent } from '../types/render.js';
import type { RenderOutput } from '../types/render.js';
import { componentNameOf, Fragment } from './factory.js';
import type { BoxProps, CanvasProps, SpacerProps, TextProps } from './intrinsics.js';

export { Fragment };
export type { BoxProps, TextProps, CanvasProps, SpacerProps };

type Props = Record<string, unknown> & { children?: unknown };

function build(
  type: string | FunctionComponent,
  props: Props,
  key?: string | number,
): ComponentNode {
  const node: ComponentNode =
    typeof type === 'string'
      ? { component: type, ...props }
      : { component: componentNameOf(type), ...props, $meta: { fn: type } };
  if (key !== undefined) node.key = key;
  return node;
}

export function jsx(
  type: string | FunctionComponent,
  props: Props,
  key?: string | number,
): ComponentNode {
  return build(type, props, key);
}

export function jsxs(
  type: string | FunctionComponent,
  props: Props,
  key?: string | number,
): ComponentNode {
  return build(type, props, key);
}

// TypeScript looks for a `JSX` namespace on the jsx-runtime module by name.
// This is the one place a namespace is not a style choice.
// eslint-disable-next-line @typescript-eslint/no-namespace
export declare namespace JSX {
  type Element = ComponentNode;

  /**
   * What may appear as a JSX tag.
   *
   * A component returns `RenderOutput` - a node, a list, a string, or nothing -
   * rather than exactly one element. Without this, TypeScript insists every
   * component return a single node, and `return null` stops compiling.
   */
  type ElementType = string | ((props: never) => RenderOutput);

  interface ElementChildrenAttribute {
    children: unknown;
  }

  /**
   * Lowercase names are host primitives - the only three shapes the layout
   * engine reasons about, plus a spacer. Everything Capitalized is a component
   * you import, which is what gives it prop types.
   */
  interface IntrinsicElements {
    box: BoxProps;
    text: TextProps;
    canvas: CanvasProps;
    spacer: SpacerProps;
  }

  interface IntrinsicAttributes {
    key?: string | number;
    id?: string;
  }
}
