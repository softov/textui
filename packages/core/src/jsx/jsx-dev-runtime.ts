import type { ComponentNode } from '../types/graph.js';
import type { FunctionComponent } from '../types/render.js';
import { jsx, Fragment, type JSX } from './jsx-runtime.js';

export { Fragment };
export type { JSX };

export function jsxDEV(
  type: string | FunctionComponent,
  props: Record<string, unknown> & { children?: unknown },
  key: string | number | undefined,
  _isStatic: boolean,
  source?: { fileName: string; lineNumber: number; columnNumber: number },
): ComponentNode {
  const node = jsx(type, props, key);
  if (source) {
    node.$meta = {
      ...node.$meta,
      source: { file: source.fileName, line: source.lineNumber, column: source.columnNumber },
    };
  }
  return node;
}
