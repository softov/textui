import type { TextProps } from '@textui/core';
import { defineComponent, h } from '@textui/core';


export interface HeadingProps extends TextProps {
  level?: 1 | 2 | 3;
}

export const Heading = defineComponent<HeadingProps>('Heading', ({ level = 1, ...props }) =>
  h('text', {
    role: 'heading',
    bold: level <= 2,
    dim: level === 3,
    fg: level === 1 ? 'text' : level === 2 ? 'text' : 'muted',
    ...props,
  }),
);
