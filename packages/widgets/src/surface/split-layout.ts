import { defineComponent, h } from '@textui/core';
import { MountView } from './mount-view.js';
import type { LayoutProps } from './shared.js';

/** Every mount, side by side, sharing the space. */
export const SplitLayout = defineComponent<LayoutProps>('SplitLayout', (props) => {
  const { mounts, surface: _surface, state: _state, direction = 'row', ...rest } = props;
  return h('box', { direction, flex: 1, gap: 1, ...rest },
    ...mounts.map((mount) => h(MountView, { key: mount.key, mount, flex: 1 })),
  );
});
