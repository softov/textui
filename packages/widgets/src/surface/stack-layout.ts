import { defineComponent, h, useTheme } from '@textui/core';
import { MountView } from './mount-view.js';
import type { LayoutProps } from './shared.js';

/** Every mount, stacked, each under its own heading. */
export const StackLayout = defineComponent<LayoutProps>('StackLayout', (props) => {
  const theme = useTheme();
  const { mounts, surface: _surface, state: _state, ...rest } = props;

  return h('box', { direction: 'column', flex: 1, ...rest },
    ...mounts.map((mount, i) =>
      // Each mount fills its share of the surface rather than only what its
      // own content needs. A content-sized wrapper hands a viewport no height
      // to measure, and a tree inside one reports a rect of 3 rows in a
      // twenty-row sidebar - or of 0, once its content overflows.
      h('box', { key: mount.key, direction: 'column', flex: 1 },
        mount.display?.title
          ? h('box', { direction: 'row', gap: 1 },
              h('text', { content: mount.display.title, bold: true, fg: 'muted' }),
              mount.display.badge !== undefined
                ? h('text', { content: String(mount.display.badge), fg: 'subtle' })
                : null,
              h('spacer', { flex: 1 }))
          : null,
        h(MountView, { mount }),
        // A rule separates two mounts. After the last one it separates a mount
        // from nothing, which is a line under a sidebar with one panel in it.
        i < mounts.length - 1
          ? h('box', { height: 1, fill: theme.borderChars().top, fg: 'borderSubtle' })
          : null)),
  );
});
