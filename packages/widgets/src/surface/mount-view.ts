import type { BindingPath, BoxProps, ComponentNode, Mount } from '@textui/core';
import { defineComponent, h, useRuntime } from '@textui/core';
import { EmptyState } from '../display/index.js';

export interface MountViewProps extends BoxProps {
  mount: Mount;
}

/** Renders one mount's target - an inline node, or a node read from a path. */
export const MountView = defineComponent<MountViewProps>('MountView', ({ mount, ...rest }) => {
  const runtime = useRuntime();

  const target = mount.target;
  const node: ComponentNode | null =
    'component' in target
      ? target
      : (runtime.store.get<ComponentNode>((target as { path: BindingPath }).path) ?? null);

  if (!node) {
    return h(EmptyState, { title: 'Nothing mounted', ...rest });
  }

  // A mount's data context makes relative paths inside it resolve against the
  // record it was opened for.
  const withContext = mount.dataContext
    ? { ...node, dataContext: mount.dataContext }
    : node;

  return h('box', { flex: 1, direction: 'column', ...rest }, withContext);
});
