import type { BoxProps, Dimension } from '@textui/core';
import { defineComponent, h } from '@textui/core';
import { Divider } from './divider.js';

export interface SplitterProps extends BoxProps {
  direction?: 'row' | 'column';
  /** Size of the first pane, in cells or percent. */
  size?: Dimension;
  /** Cells the divider occupies. 0 hides it. */
  dividerSize?: number;
}

export const Splitter = defineComponent<SplitterProps>('Splitter', (props) => {
  const { direction = 'row', size = '50%', dividerSize = 1, children, ...rest } = props;
  const panes = Array.isArray(children) ? children : [children];

  return h('box', { direction, ...rest },
    h('box', { [direction === 'row' ? 'width' : 'height']: size }, panes[0]),
    dividerSize > 0
      ? h(Divider, { direction: direction === 'row' ? 'vertical' : 'horizontal' })
      : null,
    h('box', { flex: 1 }, panes[1]),
  );
});
