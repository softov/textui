import type { BoxProps, SemanticVariant } from '@textui/core';
import { defineComponent, h, useTheme } from '@textui/core';
import { Button } from '../control/index.js';
import { useFormContext } from './shared.js';

export interface FormActionsProps extends BoxProps {
  submitLabel?: string;
  cancelLabel?: string;
  onCancel?(): void;
  tone?: SemanticVariant;
  /** Disable submit until something changed. */
  requireDirty?: boolean;
}

export const FormActions = defineComponent<FormActionsProps>('FormActions', (props) => {
  const theme = useTheme();
  const form = useFormContext();
  const {
    submitLabel = 'Submit', cancelLabel = 'Cancel', onCancel,
    tone = 'primary', requireDirty = false, ...rest
  } = props;

  const blocked = form.submitting || (requireDirty && !form.dirty);

  return h('box', { direction: 'row', gap: 1, justify: 'end', ...rest },
    onCancel ? h(Button, { label: cancelLabel, onPress: onCancel }) : null,
    h(Button, {
      label: form.submitting ? `${submitLabel}${theme.glyphs.ellipsis}` : submitLabel,
      tone,
      variant: 'solid',
      disabled: blocked,
      onPress: () => void form.submit(),
    }),
  );
});
