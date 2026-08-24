import type { BoxProps } from '@textui/core';
import { defineComponent, h } from '@textui/core';
import type { FormApi } from './shared.js';
import { FormContext } from './shared.js';

export interface FormProps extends BoxProps {
  form: FormApi<Record<string, unknown>>;
}

export const Form = defineComponent<FormProps>('Form', ({ form, children, ...rest }) =>
  h(FormContext.Provider, { value: form },
    h('box', { role: 'form', direction: 'column', ...rest }, children)),
);
