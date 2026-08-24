import type { BoxProps } from '@textui/core';
import { defineComponent, h } from '@textui/core';

export interface FormSectionProps extends BoxProps {
  title: string;
  description?: string;
}

export const FormSection = defineComponent<FormSectionProps>('FormSection', (props) => {
  const { title, description, children, ...rest } = props;
  return h('box', { direction: 'column', ...rest },
    h('text', { content: title, bold: true }),
    description ? h('text', { content: description, fg: 'muted', wrap: 'word' }) : null,
    h('box', { direction: 'column' }, children),
  );
});
