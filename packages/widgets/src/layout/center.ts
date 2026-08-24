import type { BoxProps } from '@textui/core';
import { defineComponent, h } from '@textui/core';

export interface CenterProps extends BoxProps {
  /** Centre horizontally, vertically, or both. */
  axis?: 'both' | 'horizontal' | 'vertical';
}

export const Center = defineComponent<CenterProps>('Center', ({ axis = 'both', ...props }) =>
  h('box', {
    flex: props.flex ?? 1,
    direction: 'column',
    justify: axis === 'horizontal' ? 'start' : 'center',
    align: axis === 'vertical' ? 'stretch' : 'center',
    ...props,
  }),
);
