import type { BoxProps } from '@textui/core';
import { defineComponent, h } from '@textui/core';

export const Column = defineComponent<BoxProps>('Column', (props) =>
  h('box', { direction: 'column', ...props }),
);
