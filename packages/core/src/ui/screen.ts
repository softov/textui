import type { BoxProps } from '../jsx/intrinsics.js';
import type { ComponentDefinition } from '../types/component-registry.js';
import type { RenderOutput } from '../types/render.js';
import { defineComponent, h } from '../jsx/factory.js';
import { useFocusScope } from '../runtime/hooks.js';

/**
 * What the navigator mounts.
 *
 * A screen is not a special kind of node - it is a mount in a surface, so the
 * shell arranges it, the layouts apply to it, and everything that reads the
 * surface registry sees it. What this adds is the one thing a screen needs
 * that a mount does not have: a focus scope of its own.
 *
 * That scope is what makes the stack behave. Tab order belongs to what is on
 * screen rather than to the application, and `pop` can put focus back where it
 * was because "where it was" is a question about this scope and not about
 * every focusable that ever registered.
 */
export interface ScreenProps extends BoxProps {
  screenId: string;
  children?: RenderOutput;
}

export const Screen = defineComponent<ScreenProps>('Screen', (props) => {
  const { screenId, children, ...rest } = props;
  useFocusScope({ id: `screen:${screenId}`, restore: true });
  return h('box', { direction: 'column', flex: 1, ...rest }, children as never);
});

export const SCREEN_COMPONENTS: ComponentDefinition[] = [
  {
    component: 'Screen',
    category: 'layout',
    renderer: { kind: 'function', render: Screen },
    description: 'The navigator’s mount: one screen, in its own focus scope.',
  },
];
