import { defineComponent, h } from '@textui/core';
import { MountView } from './mount-view.js';
import type { LayoutProps } from './shared.js';

/** Every mount, no chrome at all. */
export const InlineLayout = defineComponent<LayoutProps>('InlineLayout', (props) => {
  const { mounts, surface: _surface, state: _state, ...rest } = props;
  return h('box', { direction: 'column', flex: 1, ...rest },
    ...mounts.map((mount) => h(MountView, { key: mount.key, mount })),
  );
});
