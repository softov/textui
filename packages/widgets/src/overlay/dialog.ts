import type { BoxProps, SemanticVariant } from '@textui/core';
import { defineComponent, h, useFocusScope, useInput, useTheme } from '@textui/core';
import { Button } from '../control/index.js';

export interface DialogProps extends BoxProps {
  title?: string;
  /** Buttons along the bottom. The first is the default action. */
  actions?: { id: string; label: string; tone?: SemanticVariant; onPress?(): void }[];
  onClose?(): void;
  /** Cells wide. The dialog centres itself in whatever is left. */
  width?: number;
}

export const Dialog = defineComponent<DialogProps>('Dialog', (props) => {
  const theme = useTheme();
  const { title, actions = [], onClose, children, width = 50, ...rest } = props;

  // No `autoFocus` on the scope: a dialog's own controls say which of them
  // wants focus - the first action, or the field in a prompt - and the scope
  // taking it first would hand it to whichever box happened to register
  // earliest. The flag never fired before, because a scope is empty when it
  // is activated; now that it works, it has to mean what it says.
  useFocusScope({ trap: true, restore: true });

  // Only consume escape when there is something to do with it. Consuming it
  // regardless would stop the layer manager dismissing a dialog that was
  // opened without an `onClose` - which is most of them.
  useInput(
    (event) => {
      if (event.name !== 'escape' || !onClose) return false;
      onClose();
      return true;
    },
    { global: true },
  );

  return h('box', {
    role: 'dialog',
    label: title,
    border: theme.border,
    bg: 'overlay',
    padding: [0, 1],
    width,
    direction: 'column',
    title,
    ...rest,
  },
    h('box', { direction: 'column', flex: 1 }, children),
    actions.length > 0
      ? h('box', { direction: 'row', gap: 1, justify: 'end' },
          ...actions.map((action, i) =>
            h(Button, {
              key: action.id,
              label: action.label,
              tone: action.tone,
              // Every action is a line at rest; the focused one fills. Making
              // the default action solid as well meant two filled buttons the
              // moment focus moved, and no way to tell which one Enter meant.
              variant: 'outline',
              autoFocus: i === 0,
              onPress: action.onPress,
            })))
      : null,
  );
});
