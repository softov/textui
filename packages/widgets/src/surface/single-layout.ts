import { defineComponent, h } from '@textui/core';
import { MountView } from './mount-view.js';
import type { LayoutProps } from './shared.js';

/** Only the active mount. */
export const SingleLayout = defineComponent<LayoutProps>('SingleLayout', (props) => {
  const { mounts, state, surface: _surface, ...rest } = props;
  const active = mounts.find((m) => m.key === state.activeKey) ?? mounts[0];
  if (!active) return null;

  // A mount that declares a title gets one drawn, the same rule `stack`
  // follows. It matters more here: `stack` shows everything at once, so which
  // panel you are looking at is never a question, and this one shows one of
  // several and answers it no other way.
  if (active.display?.title === undefined) return h(MountView, { mount: active, ...rest });
  return h('box', { direction: 'column', flex: 1, ...rest },
    h('box', { direction: 'row', gap: 1 },
      h('text', { content: active.display.title, bold: true, fg: 'muted' }),
      active.display.badge !== undefined
        ? h('text', { content: String(active.display.badge), fg: 'subtle' })
        : null,
      h('spacer', { flex: 1 })),
    h(MountView, { mount: active, flex: 1 }),
  );
});
