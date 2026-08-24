import type { BoxProps } from '@textui/core';
import { defineComponent, h } from '@textui/core';

export interface RowProps extends BoxProps {
  /** Shorthand for `align`, which reads better on a row. */
  vAlign?: BoxProps['align'];
}

export const Row = defineComponent<RowProps>('Row', ({ vAlign, ...props }) =>
  h('box', { direction: 'row', align: vAlign ?? props.align ?? 'center', ...props }),
);
