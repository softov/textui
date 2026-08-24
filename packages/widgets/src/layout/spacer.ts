import type { BoxProps } from '@textui/core';
import { defineComponent, h } from '@textui/core';

export interface SpacerProps extends BoxProps {
  size?: number;
}

export const Spacer = defineComponent<SpacerProps>('Spacer', ({ size, ...props }) =>
  h('spacer', { size, flex: size === undefined ? 1 : 0, ...props }),
);
