import type { BoxProps } from '@textui/core';
import { defineComponent, h, useI18n, useState } from '@textui/core';
import { TextInput } from '../control/index.js';
import { Dialog } from './dialog.js';

export interface PromptDialogProps extends BoxProps {
  title?: string;
  message?: string;
  placeholder?: string;
  initialValue?: string;
  mask?: string;
  onSubmit?(value: string): void;
  onCancel?(): void;
}

export const PromptDialog = defineComponent<PromptDialogProps>('PromptDialog', (props) => {
  const { title, message, placeholder, initialValue = '', mask, onSubmit, onCancel, ...rest } = props;
  const i18n = useI18n();
  const [value, setValue] = useState(initialValue);

  return h(Dialog, {
    title: title ?? i18n.t('textui.promptDialog.title', undefined, 'Input'),
    width: 50,
    onClose: onCancel,
    actions: [
      { id: 'ok', label: i18n.t('textui.promptDialog.ok', undefined, 'OK'), tone: 'primary', onPress: () => onSubmit?.(value) },
      { id: 'cancel', label: i18n.t('textui.promptDialog.cancel', undefined, 'Cancel'), onPress: onCancel },
    ],
    ...rest,
  },
    message ? h('text', { content: message, wrap: 'word' }) : null,
    h(TextInput, {
      value,
      onChange: setValue,
      placeholder,
      mask,
      // The message names the field: an unlabelled input is a focus stop
      // nothing can describe, in the dialog whose whole job is one question.
      // It is already on screen above, so it is not drawn twice.
      label: message,
      hideLabel: true,
      autoFocus: true,
      onSubmit: () => onSubmit?.(value),
    }),
  );
});
