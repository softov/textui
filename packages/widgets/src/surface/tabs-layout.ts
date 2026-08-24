import { defineComponent, h, useRuntime } from '@textui/core';
import { Tabs } from '../navigation/index.js';
import { MountView } from './mount-view.js';
import type { LayoutProps } from './shared.js';

/** A tab strip and the active mount. */
export const TabsLayout = defineComponent<LayoutProps>('TabsLayout', (props) => {
  const runtime = useRuntime();
  const { mounts, state, surface, ...rest } = props;
  if (mounts.length === 0) return null;

  const active = mounts.find((m) => m.key === state.activeKey) ?? mounts[0];
  const app = runtime.app();

  return h('box', { direction: 'column', flex: 1, ...rest },
    mounts.length > 1
      ? h(Tabs, {
          items: mounts.map((m) => ({
            id: m.key,
            label: m.display?.title ?? m.key,
            icon: m.display?.icon,
            badge: m.display?.badge,
          })),
          activeId: active?.key,
          onChange: (key: string) => app?.surfaces.activate(surface, key),
        })
      : null,
    active ? h(MountView, { mount: active, flex: 1 }) : null,
  );
});
