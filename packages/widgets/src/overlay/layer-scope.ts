import type { ComponentNode, RenderOutput } from '@textui/core';
import { defineComponent, useFocusScope } from '@textui/core';

/**
 * The focus scope a layer lives in.
 *
 * `trapFocus` on a layer used to be a flag nothing read: `Dialog` and
 * `CommandPalette` trapped because they each called `useFocusScope`
 * themselves, and any layer built out of plain nodes - a menu dropdown, say -
 * silently did not. Tab then walked straight out of the open thing and into
 * whatever was behind it, and the next key went with it.
 *
 * Wrapping every layer in this makes the flag mean what it says, once, for all
 * of them. It renders its child rather than a box of its own, so a layer's
 * measurements are unchanged by being scoped.
 */
export interface LayerScopeProps {
  scopeId: string;
  trap?: boolean;
  children?: ComponentNode | ComponentNode[];
}

export const LayerScope = defineComponent<LayerScopeProps>('LayerScope', (props) => {
  useFocusScope({ id: `layer:${props.scopeId}`, trap: props.trap === true, restore: true });
  return (props.children ?? null) as RenderOutput;
});
