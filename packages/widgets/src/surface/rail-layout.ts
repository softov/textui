import { defineComponent, h, useRuntime, useTheme } from '@textui/core';
import type { LayoutProps } from './shared.js';

/** Icons only, one per mount. An activity bar. */
export const RailLayout = defineComponent<LayoutProps>('RailLayout', (props) => {
  const runtime = useRuntime();
  const theme = useTheme();
  const { mounts, state, surface, ...rest } = props;
  const app = runtime.app();

  return h('box', { direction: 'column', width: 3, align: 'center', ...rest },
    ...mounts.map((mount) => {
      const active = mount.key === state.activeKey;
      return h('box', {
        key: mount.key,
        direction: 'row',
        gap: 0,
        fg: active ? 'accent' : 'muted',
        bold: active,
        onClick: () => app?.surfaces.activate(surface, mount.key),
      },
        h('text', { content: active ? theme.glyphs.chevronRight : ' ' }),
        h('text', { content: mount.display?.icon ?? mount.key.slice(0, 1).toUpperCase() }),
      );
    }),
  );
});
