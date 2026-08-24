import type { BoxProps } from '@textui/core';
import { defineComponent, h, useEffect, useRuntime } from '@textui/core';

export interface ToastHostProps extends BoxProps {
  /** Where the stack sits. Named `anchor` so it does not shadow `position`. */
  anchor?: 'top-right' | 'bottom-right' | 'top' | 'bottom';
}

/** Renders whatever is on the notification layer. */
export const ToastHost = defineComponent<ToastHostProps>('ToastHost', (props) => {
  const runtime = useRuntime();
  const { anchor = 'bottom-right', ...rest } = props;
  const entries = runtime.layers.entries('notification');

  useEffect(() => {
    // Re-render when the layer set changes; the manager already asks for a
    // frame, this only keeps the subscription honest.
  }, [entries.length]);

  if (entries.length === 0) return null;

  return h('box', {
    direction: 'column',
    gap: 1,
    align: anchor.endsWith('right') ? 'end' : 'stretch',
    ...rest,
  },
    ...entries.map((entry) => h('box', { key: entry.id }, entry.node)),
  );
});
