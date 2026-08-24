import { defineComponent, h } from '@textui/core';
import { MountView } from './mount-view.js';
import type { LayoutProps } from './shared.js';

/** Every mount on one line. Headers and status bars use this. */
export const BarLayout = defineComponent<LayoutProps>('BarLayout', (props) => {
  const { mounts, surface: _surface, state: _state, ...rest } = props;
  return h('box', { direction: 'row', height: 1, gap: 2, ...rest },
    ...mounts.map((mount) => h(MountView, { key: mount.key, mount })),
  );
});
